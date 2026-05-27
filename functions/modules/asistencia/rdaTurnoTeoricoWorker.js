"use strict";

/**
 * rdaTurnoTeoricoWorker — Materialización batch del turno teórico en asi_* y vis_*.
 *
 * Estrategia optimizada: pre-carga HLG + régimen + calendario 1 vez por agente/mes,
 * luego itera 30 días leyendo solo overrides. Batch write atómico.
 *
 * ~33 reads + 31 writes = 64 ops por agente/mes (vs ~211 sin optimización).
 */

const { db, FieldValue } = require("../shared/context");
const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd } = require("../shared/mdcRdaDocumentIds");
const { getIndiceCalendario } = require("../shared/calendarService");
const { resolverEventoEnIndice } = require("../shared/calendarInstitucionalCore");
const { resolverFijo, resolverRotativo, buildTurnoResponse, ymdToDate, diffDays, isoWeekday } = require("./resolverTurnoDia");
const { buildCapaTeoricaSegmentada } = require("./capaTeoricaSegmentosCore");
const { CFG_EPL_ABIERTO } = require("../shared/cfgAsistenciaTurnosIds");
const { logger } = require("firebase-functions/v2");

const COL_HLG = "historial_laboral_grupos";
const COL_GDT = "grupos_de_trabajo";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_ASISTENCIA = "asistencia_diaria";
const COL_PLANES = "planes_turno_servicio";
const COL_VIS = "vistas_grilla_mes_agente";

/**
 * Genera array de "YYYY-MM-DD" para todos los días de un mes.
 * Usa aritmética de strings para evitar problemas de timezone.
 */
function diasDelMes(anio, mes) {
  const totalDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const out = [];
  const prefix = `${anio}-${String(mes).padStart(2, "0")}`;
  for (let d = 1; d <= totalDias; d++) {
    out.push(`${prefix}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Resuelve etiqueta corta del grupo de trabajo (nombre || codigo || titulo).
 * @param {Map<string, string>} cache - shared across the batch
 * @param {string} gdtId
 * @returns {Promise<string>}
 */
async function resolverEtiquetaGrupo(cache, gdtId) {
  const id = String(gdtId || "").trim();
  if (!id) return "";
  if (cache.has(id)) return cache.get(id);
  if (!/^gdt_/i.test(id)) { cache.set(id, id); return id; }
  const snap = await db.collection(COL_GDT).doc(id).get();
  const d = snap.exists ? (snap.data() || {}) : {};
  const label = String(d.nombre || d.codigo || d.titulo || "").trim() || id;
  cache.set(id, label);
  return label;
}

/**
 * Obtiene TODOS los HLG vigentes para persona en un rango de mes.
 * @returns {Promise<Array<object>>} lista de HLG (data + id)
 */
async function obtenerHlgsVigentesParaMes(personaId, primerDia, ultimoDia) {
  const snap = await db.collection(COL_HLG)
    .where("persona_id", "==", personaId)
    .where("activo", "==", true)
    .get();
  if (snap.empty) return [];

  const result = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const fi = d.fecha_inicio || "";
    const ff = d.fecha_fin || "";
    if (fi && fi > ultimoDia) continue;
    if (ff && ff < primerDia) continue;
    result.push({ id: doc.id, ...d });
  }
  return result;
}

/**
 * Obtiene plan habilitado para grupo+periodo.
 * @returns {Promise<{ planId: string, plan: object }|null>}
 */
async function obtenerPlanHabilitado(grupoId, periodoId) {
  const snap = await db.collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodoId)
    .where("estado", "==", "HABILITADO")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { planId: snap.docs[0].id, plan: snap.docs[0].data() };
}

function esOverrideActivo(ov) {
  return ov && !ov.eliminado && !ov.invalidado_por_replanificacion;
}

function esTipoLaboral(tipoDia) {
  return tipoDia === "laborable" || tipoDia === "guardia";
}

async function ensureEstadoPeriodoLiquidacionAbierto(visRef) {
  const snap = await visRef.get();
  if (!snap.exists) return;
  const estado = snap.data()?.estado_periodo_liquidacion_id ?? null;
  if (estado == null || String(estado).trim() === "") {
    await visRef.set({ estado_periodo_liquidacion_id: CFG_EPL_ABIERTO }, { merge: true });
  }
}

async function resolverBaseDiaPersona({ personaId, fechaYmd, indiceCalendario }) {
  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const hlgs = await obtenerHlgsVigentesParaMes(personaId, fechaYmd, fechaYmd);
  if (!hlgs.length) return null;

  const regCache = new Map();
  const hlgContextos = [];
  for (const hlg of hlgs) {
    if (!hlg.regimen_horario_id) continue;
    let regimen = regCache.get(hlg.regimen_horario_id);
    if (!regimen) {
      const snap = await db.collection(COL_REGIMEN).doc(hlg.regimen_horario_id).get();
      if (!snap.exists) continue;
      regimen = snap.data();
      regCache.set(hlg.regimen_horario_id, regimen);
    }
    let plan = null;
    if (regimen.tipo_patron === "planificado" && hlg.grupo_de_trabajo_id) {
      plan = await obtenerPlanHabilitado(hlg.grupo_de_trabajo_id, periodoId);
    }
    hlgContextos.push({ hlg, regimen, plan });
  }
  if (!hlgContextos.length) return null;

  let mejorResolucion = null;
  let mejorHlg = null;
  for (const { hlg, regimen, plan } of hlgContextos) {
    const fi = hlg.fecha_inicio || "";
    const ff = hlg.fecha_fin || "";
    if (fi && fi > fechaYmd) continue;
    if (ff && ff < fechaYmd) continue;

    const res = resolverDiaConPreCarga(regimen, fechaYmd, hlg, plan, personaId, indiceCalendario);
    if (!mejorResolucion) {
      mejorResolucion = res;
      mejorHlg = hlg;
      continue;
    }
    if (esTipoLaboral(res.tipo_dia) && !esTipoLaboral(mejorResolucion.tipo_dia)) {
      mejorResolucion = res;
      mejorHlg = hlg;
    }
  }
  if (!mejorResolucion || !mejorHlg) return null;

  const regimenDoc = regCache.get(mejorHlg.regimen_horario_id) || {};
  let turnoCompuestoId = mejorResolucion.turno_teorico?.turno_id || null;
  if (!turnoCompuestoId) {
    const ctxPlan = hlgContextos.find((c) => c.hlg.id === mejorHlg.id);
    const agPlan = ctxPlan?.plan?.plan?.agentes?.find((a) => a.persona_id === personaId);
    turnoCompuestoId = agPlan?.dias?.[fechaYmd]?.turno_id || null;
  }

  const capaBase = buildCapaTeoricaSegmentada({
    fechaYmd,
    personaId,
    regimen: regimenDoc,
    tipo_dia: mejorResolucion.tipo_dia,
    turnoCompuestoId,
    origen_segmento: "plan_base",
    indiceCalendario,
  });

  return {
    capaBase,
    mejorResolucion,
    mejorHlg,
    regimenDoc,
  };
}

function upsertSegmento(segmentos, segmentoNuevo) {
  const idx = segmentos.findIndex((s) => s.segmento_id === segmentoNuevo.segmento_id
    && s.persona_titular_id === segmentoNuevo.persona_titular_id
    && s.persona_ejecutante_id === segmentoNuevo.persona_ejecutante_id);
  if (idx >= 0) segmentos[idx] = segmentoNuevo;
  else segmentos.push(segmentoNuevo);
}

async function listarCoberturasDia(fechaYmd, personaId) {
  const snap = await db.collection(COL_ASISTENCIA).where("fecha", "==", fechaYmd).get();
  const out = [];
  for (const doc of snap.docs) {
    const all = Array.isArray(doc.data()?.overrides_turno) ? doc.data().overrides_turno : [];
    for (const ov of all) {
      if (!esOverrideActivo(ov)) continue;
      if (ov.tipo !== "cobertura_parcial") continue;
      if (ov.persona_origen_id === personaId || ov.persona_cobertura_id === personaId) out.push(ov);
    }
  }
  return out;
}

async function aplicarCoberturasParciales({ personaId, fechaYmd, segmentos, coberturas, indiceCalendario }) {
  const result = [...segmentos];
  for (const ov of coberturas) {
    const ids = Array.isArray(ov.segmentos_cubiertos) ? ov.segmentos_cubiertos : [];
    if (!ids.length) continue;
    if (ov.persona_origen_id === personaId) {
      for (const seg of result) {
        if (!ids.includes(seg.segmento_id)) continue;
        seg.persona_ejecutante_id = ov.persona_cobertura_id || seg.persona_ejecutante_id;
        seg.origen_segmento = "override_cobertura";
        seg.tipo_compensacion_id = ov.tipo_compensacion_id || null;
      }
      continue;
    }
    if (ov.persona_cobertura_id !== personaId) continue;

    const baseOrigen = await resolverBaseDiaPersona({
      personaId: ov.persona_origen_id,
      fechaYmd,
      indiceCalendario,
    });
    const segmentosOrigen = baseOrigen?.capaBase?.segmentos || [];
    for (const seg of segmentosOrigen) {
      if (!ids.includes(seg.segmento_id)) continue;
      upsertSegmento(result, {
        ...seg,
        persona_titular_id: ov.persona_origen_id,
        persona_ejecutante_id: personaId,
        origen_segmento: "override_cobertura",
        tipo_compensacion_id: ov.tipo_compensacion_id || null,
      });
    }
  }
  result.sort((a, b) => a.ingreso_iso.localeCompare(b.ingreso_iso));
  return result;
}

/**
 * Resuelve el turno teórico para un día, usando datos pre-cargados.
 * NO hace reads a Firestore (excepto override).
 */
function resolverDiaConPreCarga(regimen, fechaYmd, hlg, planData, personaId, indiceCalendario) {
  const fechaDate = ymdToDate(fechaYmd);
  let resolucion;

  switch (regimen.tipo_patron) {
    case "fijo": {
      const r = resolverFijo(regimen, fechaDate);
      resolucion = { ...r, origen: "regimen_fijo", plan_id: null, posicion_ciclo: null };
      break;
    }
    case "rotativo": {
      const anclaYmd = hlg.regimen_fecha_ancla;
      if (!anclaYmd) {
        resolucion = { tipo_dia: "no_laborable", turno_teorico: null, origen: "regimen_rotativo", plan_id: null, posicion_ciclo: 0 };
        break;
      }
      const ancla = ymdToDate(anclaYmd);
      const diff = diffDays(ancla, fechaDate);
      const cicloTotal = regimen.ciclo_total || regimen.ciclo.length;
      const posRaw = ((diff % cicloTotal) + cicloTotal) % cicloTotal;
      const posicion = posRaw + 1;
      const posConf = (regimen.ciclo || []).find((p) => p.posicion === posicion);
      if (!posConf) {
        resolucion = { tipo_dia: "no_laborable", turno_teorico: null, origen: "regimen_rotativo", plan_id: null, posicion_ciclo: posicion };
      } else {
        resolucion = {
          tipo_dia: posConf.tipo_dia,
          turno_teorico: buildTurnoResponse(posConf.turno),
          origen: "regimen_rotativo",
          plan_id: null,
          posicion_ciclo: posicion,
        };
      }
      break;
    }
    case "planificado": {
      if (!planData) {
        resolucion = { tipo_dia: "no_laborable", turno_teorico: null, origen: "plan_mensual", plan_id: null, posicion_ciclo: null };
        break;
      }
      const agentePlan = (planData.plan.agentes || []).find((a) => a.persona_id === personaId);
      const asignacionDia = agentePlan?.dias?.[fechaYmd];
      if (!asignacionDia || asignacionDia.tipo_dia === "franco") {
        resolucion = {
          tipo_dia: asignacionDia?.tipo_dia || "franco",
          turno_teorico: null,
          origen: "plan_mensual",
          plan_id: planData.planId,
          posicion_ciclo: null,
        };
      } else {
        const turnoId = asignacionDia.turno_id;
        const turnoDisp = (regimen.turnos_disponibles || []).find((t) => t.turno_id === turnoId);
        resolucion = {
          tipo_dia: asignacionDia.tipo_dia || "laborable",
          turno_teorico: turnoDisp ? buildTurnoResponse(turnoDisp) : null,
          origen: "plan_mensual",
          plan_id: planData.planId,
          posicion_ciclo: null,
        };
      }
      break;
    }
    default:
      resolucion = { tipo_dia: "no_laborable", turno_teorico: null, origen: "sin_regimen", plan_id: null, posicion_ciclo: null };
  }

  if (regimen.impacta_calendario_institucional !== false && indiceCalendario) {
    const evento = resolverEventoEnIndice(fechaYmd, indiceCalendario);
    if (evento) {
      const esLaborable = resolucion.tipo_dia === "laborable" || resolucion.tipo_dia === "guardia";
      if (esLaborable) {
        resolucion.tipo_dia = "no_laborable";
        resolucion.turno_teorico = null;
      }
      resolucion.es_feriado = true;
      resolucion.tipo_evento = evento.tipo || "feriado";
      resolucion.multiplicador = typeof evento.multiplicador === "number" ? evento.multiplicador : 1;
    }
  }

  return resolucion;
}

/**
 * Materializa turno teórico para 1 agente × 1 mes, fusionando TODOS los HLG activos.
 *
 * Cada día se asigna al primer HLG cuyo régimen lo marque como laborable/guardia.
 * Días sin asignación de ningún grupo quedan como franco.
 *
 * @param {object} params
 * @param {string} params.personaId
 * @param {string} [params.grupoId] - ignorado (se resuelven todos los HLG)
 * @param {number} params.anio
 * @param {number} params.mes
 * @param {object} [params.regimenCache] - Map<regimenId, regimenDoc> para dedup
 * @param {object} [params.planCache] - { planId, plan } pre-cargado (solo planificado)
 * @returns {Promise<{ ok: boolean, diasProcesados: number, error?: string }>}
 */
async function materializarTurnoMesBatch({ personaId, grupoId: _grupoId, anio, mes, regimenCache, planCache, etiquetaGrupoCache }) {
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const dias = diasDelMes(anio, mes);
  if (dias.length === 0) return { ok: false, diasProcesados: 0, error: "Mes inválido" };

  const primerDia = dias[0];
  const ultimoDia = dias[dias.length - 1];
  const regCache = regimenCache || new Map();
  const etqCache = etiquetaGrupoCache || new Map();

  const hlgs = await obtenerHlgsVigentesParaMes(personaId, primerDia, ultimoDia);
  if (hlgs.length === 0) {
    return { ok: true, diasProcesados: 0, error: "Sin HLG vigente" };
  }

  const indiceCalendario = await getIndiceCalendario();

  // Pre-cargar regímenes, planes y etiquetas de todos los HLG
  const hlgContextos = [];
  for (const hlg of hlgs) {
    if (!hlg.regimen_horario_id) continue;
    let regimen;
    if (regCache.has(hlg.regimen_horario_id)) {
      regimen = regCache.get(hlg.regimen_horario_id);
    } else {
      const snap = await db.collection(COL_REGIMEN).doc(hlg.regimen_horario_id).get();
      if (!snap.exists) continue;
      regimen = snap.data();
      regCache.set(hlg.regimen_horario_id, regimen);
    }
    let plan = planCache || null;
    if (!plan && regimen.tipo_patron === "planificado" && hlg.grupo_de_trabajo_id) {
      plan = await obtenerPlanHabilitado(hlg.grupo_de_trabajo_id, periodoId);
    }
    if (hlg.grupo_de_trabajo_id) {
      await resolverEtiquetaGrupo(etqCache, hlg.grupo_de_trabajo_id);
    }
    hlgContextos.push({ hlg, regimen, plan });
  }

  if (hlgContextos.length === 0) {
    return { ok: true, diasProcesados: 0, error: "Sin HLG con régimen válido" };
  }

  // --- ITERACION POR DIA: fusionar todos los HLG ---
  const batch = db.batch();
  const visDias = {};
  let diasProcesados = 0;

  for (const fechaYmd of dias) {
    let mejorResolucion = null;
    let mejorHlg = null;

    for (const { hlg, regimen, plan } of hlgContextos) {
      const fi = hlg.fecha_inicio || "";
      const ff = hlg.fecha_fin || "";
      if (fi && fi > fechaYmd) continue;
      if (ff && ff < fechaYmd) continue;

      const res = resolverDiaConPreCarga(regimen, fechaYmd, hlg, plan, personaId, indiceCalendario);
      const esLaboral = res.tipo_dia === "laborable" || res.tipo_dia === "guardia";
      if (!mejorResolucion) {
        mejorResolucion = res;
        mejorHlg = hlg;
      } else if (esLaboral) {
        const mejorEsLaboral = mejorResolucion.tipo_dia === "laborable" || mejorResolucion.tipo_dia === "guardia";
        if (!mejorEsLaboral) {
          mejorResolucion = res;
          mejorHlg = hlg;
        }
      }
    }

    if (!mejorResolucion || !mejorHlg) continue;

    const asiDocId = buildAsiDocumentId(personaId, fechaYmd);
    if (!asiDocId) continue;
    const asiRef = db.collection(COL_ASISTENCIA).doc(asiDocId);
    const asiSnap = await asiRef.get();
    const overrides = asiSnap.exists
      ? (asiSnap.data().overrides_turno || []).filter((o) => o.tipo === "reemplazo" && !o.invalidado_por_replanificacion)
      : [];

    let turnoFinal = mejorResolucion.turno_teorico;
    let origenFinal = mejorResolucion.origen;
    let tipoDiaFinal = mejorResolucion.tipo_dia;
    if (overrides.length > 0) {
      const ultimo = overrides[overrides.length - 1];
      turnoFinal = buildTurnoResponse(ultimo.turno || ultimo);
      origenFinal = "override";
      tipoDiaFinal = ultimo.tipo_dia || "laborable";
    }

    const regimenDoc = regCache.get(mejorHlg.regimen_horario_id) || {};
    let turnoCompuestoId = turnoFinal?.turno_id || null;
    if (!turnoCompuestoId) {
      const ctxPlan = hlgContextos.find((c) => c.hlg.id === mejorHlg.id);
      const agPlan = ctxPlan?.plan?.plan?.agentes?.find((a) => a.persona_id === personaId);
      turnoCompuestoId = agPlan?.dias?.[fechaYmd]?.turno_id || null;
    }
    const capaSegmentada = buildCapaTeoricaSegmentada({
      fechaYmd,
      personaId,
      regimen: regimenDoc,
      tipo_dia: tipoDiaFinal,
      turnoCompuestoId,
      origen_segmento: origenFinal === "override" ? "override_cobertura" : "plan_base",
      indiceCalendario,
    });

    const capaTeorica = {
      ...capaSegmentada,
      es_nocturno: turnoFinal?.es_nocturno || false,
      origen: origenFinal,
      regimen_horario_id: mejorHlg.regimen_horario_id,
      grupo_de_trabajo_id: mejorHlg.grupo_de_trabajo_id || null,
      plan_id: mejorResolucion.plan_id || null,
      posicion_ciclo: mejorResolucion.posicion_ciclo ?? null,
    };

    batch.set(asiRef, {
      persona_id: personaId,
      fecha: fechaYmd,
      "capa_teorica": capaTeorica,
    }, { merge: true });

    const diaKey = diaMesKeyDesdeYmd(fechaYmd);
    const esFranco = tipoDiaFinal === "franco" || tipoDiaFinal === "no_laborable";
    const gdtId = capaTeorica.grupo_de_trabajo_id || null;
    visDias[`dias.${diaKey}.rda_turno_id`] = esFranco ? null : (capaTeorica.turno_id || capaTeorica.ingreso || tipoDiaFinal);
    visDias[`dias.${diaKey}.rda_ingreso`] = esFranco ? null : (capaTeorica.ingreso || null);
    visDias[`dias.${diaKey}.rda_egreso`] = esFranco ? null : (capaTeorica.egreso || null);
    visDias[`dias.${diaKey}.es_franco`] = esFranco;
    visDias[`dias.${diaKey}.es_feriado`] = capaTeorica.es_feriado || false;
    visDias[`dias.${diaKey}.clasificacion_dia_calendario_id`] = capaTeorica.clasificacion_dia_calendario_id || null;
    visDias[`dias.${diaKey}.tipo_evento_institucional`] = mejorResolucion.tipo_evento || null;
    visDias[`dias.${diaKey}.grupo_de_trabajo_id`] = gdtId;
    visDias[`dias.${diaKey}.etiqueta_grupo_corta`] = gdtId ? (etqCache.get(gdtId) || gdtId) : null;

    diasProcesados++;
  }

  if (diasProcesados === 0) return { ok: true, diasProcesados: 0 };

  await batch.commit();

  // vis_*: update() interpreta dot-notation como paths anidados (set() no lo hace)
  const visDocId = buildVisDocumentId(personaId, `${anio}-${String(mes).padStart(2, "0")}-01`);
  if (visDocId) {
    const visRef = db.collection(COL_VIS).doc(visDocId);
    const visUpdateData = {
      ...visDias,
      "metadata.ultima_sync_teorica": FieldValue.serverTimestamp(),
    };
    try {
      await visRef.update(visUpdateData);
      await ensureEstadoPeriodoLiquidacionAbierto(visRef);
    } catch (e) {
      if (e.code === 5 || (e.message && e.message.includes("NOT_FOUND"))) {
        const nestedDias = {};
        for (const [key, value] of Object.entries(visDias)) {
          const parts = key.split(".");
          if (!nestedDias[parts[1]]) nestedDias[parts[1]] = {};
          nestedDias[parts[1]][parts[2]] = value;
        }
        await visRef.set({
          persona_id: personaId,
          anio,
          mes,
          dias: nestedDias,
          estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
          metadata: { ultima_sync_teorica: FieldValue.serverTimestamp() },
        }, { merge: true });
        await ensureEstadoPeriodoLiquidacionAbierto(visRef);
      } else {
        throw e;
      }
    }
  }

  return { ok: true, diasProcesados };
}

/**
 * Materializa turno teórico para un grupo completo × 1 mes.
 *
 * Optimizaciones:
 * - Regímenes deduplicados (Map cache)
 * - Calendario cacheado (servicio existente TTL 5min)
 * - Paralelismo controlado: chunks de 5 agentes
 * - Promise.allSettled para tolerancia a fallos
 *
 * @param {object} params
 * @param {string} params.grupoId
 * @param {number} params.anio
 * @param {number} params.mes
 * @returns {Promise<{ ok: boolean, procesados: number, fallos: Array<{ personaId: string, error: string }> }>}
 */
async function materializarGrupoMes({ grupoId, anio, mes }) {
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const primerDia = `${periodoId}-01`;
  const ultimoDia = diasDelMes(anio, mes).pop() || primerDia;

  // Query HLGs activos del grupo
  const hlgSnap = await db.collection(COL_HLG)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("activo", "==", true)
    .get();

  if (hlgSnap.empty) return { ok: true, procesados: 0, fallos: [] };

  // Filtrar por vigencia cruzada con el mes
  const agentes = [];
  for (const doc of hlgSnap.docs) {
    const d = doc.data();
    const fi = d.fecha_inicio || "";
    const ff = d.fecha_fin || "";
    if (fi && fi > ultimoDia) continue;
    if (ff && ff < primerDia) continue;
    agentes.push({ personaId: d.persona_id, hlgId: doc.id, regimenId: d.regimen_horario_id });
  }

  if (agentes.length === 0) return { ok: true, procesados: 0, fallos: [] };

  // Dedup regímenes: pre-cargar los distintos
  const regimenCache = new Map();
  const regimenIdsUnicos = [...new Set(agentes.map((a) => a.regimenId).filter(Boolean))];
  await Promise.all(regimenIdsUnicos.map(async (rid) => {
    const snap = await db.collection(COL_REGIMEN).doc(rid).get();
    if (snap.exists) regimenCache.set(rid, snap.data());
  }));

  // Plan habilitado para planificados
  let planCache = null;
  const tienesPlanificado = agentes.some((a) => {
    const reg = regimenCache.get(a.regimenId);
    return reg?.tipo_patron === "planificado";
  });
  if (tienesPlanificado) {
    planCache = await obtenerPlanHabilitado(grupoId, periodoId);
  }

  const etiquetaGrupoCache = new Map();

  // Chunks de 5 agentes con Promise.allSettled
  const CHUNK_SIZE = 5;
  const fallos = [];
  let procesados = 0;

  for (let i = 0; i < agentes.length; i += CHUNK_SIZE) {
    const chunk = agentes.slice(i, i + CHUNK_SIZE);
    const resultados = await Promise.allSettled(
      chunk.map((ag) =>
        materializarTurnoMesBatch({
          personaId: ag.personaId,
          grupoId,
          anio,
          mes,
          regimenCache,
          planCache,
          etiquetaGrupoCache,
        })
      )
    );
    for (let j = 0; j < resultados.length; j++) {
      const r = resultados[j];
      if (r.status === "rejected") {
        fallos.push({ personaId: chunk[j].personaId, error: String(r.reason) });
        logger.error("materializarGrupoMes_agente_error", { personaId: chunk[j].personaId, grupoId, error: String(r.reason) });
      } else if (!r.value.ok) {
        fallos.push({ personaId: chunk[j].personaId, error: r.value.error || "Error desconocido" });
      } else {
        procesados += r.value.diasProcesados;
      }
    }
  }

  return { ok: fallos.length === 0, procesados, fallos };
}

/**
 * Materializa un solo día para un agente.
 * Usado por triggers de override (registrarCambioTurno / eliminarCambioTurno).
 */
async function materializarTurnoTeoricoDia({ personaId, grupoId, fechaYmd }) {
  const _grupoId = grupoId;
  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const indiceCalendario = await getIndiceCalendario();
  const base = await resolverBaseDiaPersona({ personaId, fechaYmd, indiceCalendario });
  if (!base) return { ok: true, diasProcesados: 0, error: "Sin HLG vigente para fecha" };

  const asiDocId = buildAsiDocumentId(personaId, fechaYmd);
  if (!asiDocId) return { ok: false, diasProcesados: 0, error: "DocId asistencia inválido" };
  const asiRef = db.collection(COL_ASISTENCIA).doc(asiDocId);
  const asiSnap = await asiRef.get();
  const allOverrides = asiSnap.exists && Array.isArray(asiSnap.data().overrides_turno)
    ? asiSnap.data().overrides_turno
    : [];
  const activos = allOverrides.filter(esOverrideActivo);

  const reemplazos = activos.filter((o) => o.tipo === "reemplazo");
  const adicionales = activos.filter((o) => o.tipo === "adicional");
  const coberturas = await listarCoberturasDia(fechaYmd, personaId);

  let turnoCompuestoId = base.mejorResolucion.turno_teorico?.turno_id || base.capaBase.turno_compuesto_id || null;
  let tipoDiaFinal = base.capaBase.tipo_dia || base.mejorResolucion.tipo_dia;
  if (reemplazos.length > 0) {
    const ultimo = reemplazos[reemplazos.length - 1];
    turnoCompuestoId = ultimo.turno_id || turnoCompuestoId;
    tipoDiaFinal = ultimo.tipo_dia || "laborable";
  }

  let segmentos = [];
  if (turnoCompuestoId && tipoDiaFinal !== "franco" && tipoDiaFinal !== "no_laborable") {
    const capaPre = buildCapaTeoricaSegmentada({
      fechaYmd,
      personaId,
      regimen: base.regimenDoc,
      tipo_dia: tipoDiaFinal,
      turnoCompuestoId,
      origen_segmento: reemplazos.length > 0 ? "override_cobertura" : "plan_base",
      indiceCalendario,
    });
    segmentos = capaPre.segmentos || [];
  }

  for (const adicional of adicionales) {
    if (!adicional.turno_id) continue;
    const capaAdd = buildCapaTeoricaSegmentada({
      fechaYmd,
      personaId,
      regimen: base.regimenDoc,
      tipo_dia: "laborable",
      turnoCompuestoId: adicional.turno_id,
      origen_segmento: "override_cobertura",
      indiceCalendario,
    });
    for (const seg of capaAdd.segmentos || []) {
      upsertSegmento(segmentos, seg);
    }
  }

  segmentos = await aplicarCoberturasParciales({
    personaId,
    fechaYmd,
    segmentos,
    coberturas,
    indiceCalendario,
  });

  const tipoDiaDerivado = segmentos.length > 0 ? "laborable" : tipoDiaFinal;
  const capaSegmentada = buildCapaTeoricaSegmentada({
    fechaYmd,
    personaId,
    regimen: base.regimenDoc,
    tipo_dia: tipoDiaDerivado,
    turnoCompuestoId: null,
    origen_segmento: "plan_base",
    indiceCalendario,
    segmentosOverride: segmentos,
  });

  const capaTeorica = {
    ...capaSegmentada,
    es_nocturno: false,
    origen: reemplazos.length > 0 ? "override" : base.mejorResolucion.origen,
    regimen_horario_id: base.mejorHlg.regimen_horario_id,
    grupo_de_trabajo_id: base.mejorHlg.grupo_de_trabajo_id || _grupoId || null,
    plan_id: base.mejorResolucion.plan_id || null,
    posicion_ciclo: base.mejorResolucion.posicion_ciclo ?? null,
  };

  await asiRef.set({
    persona_id: personaId,
    fecha: fechaYmd,
    capa_teorica: capaTeorica,
  }, { merge: true });

  const visDocId = buildVisDocumentId(personaId, `${periodoId}-01`);
  if (visDocId) {
    const diaKey = diaMesKeyDesdeYmd(fechaYmd);
    const esFranco = capaTeorica.tipo_dia === "franco" || capaTeorica.tipo_dia === "no_laborable";
    const gdtId = capaTeorica.grupo_de_trabajo_id || null;
    const visRef = db.collection(COL_VIS).doc(visDocId);
    const visUpdate = {
      [`dias.${diaKey}.rda_turno_id`]: esFranco ? null : (capaTeorica.turno_id || capaTeorica.ingreso || capaTeorica.tipo_dia),
      [`dias.${diaKey}.rda_ingreso`]: esFranco ? null : (capaTeorica.ingreso || null),
      [`dias.${diaKey}.rda_egreso`]: esFranco ? null : (capaTeorica.egreso || null),
      [`dias.${diaKey}.es_franco`]: esFranco,
      [`dias.${diaKey}.es_feriado`]: capaTeorica.es_feriado || false,
      [`dias.${diaKey}.clasificacion_dia_calendario_id`]: capaTeorica.clasificacion_dia_calendario_id || null,
      [`dias.${diaKey}.tipo_evento_institucional`]: base.mejorResolucion.tipo_evento || null,
      [`dias.${diaKey}.grupo_de_trabajo_id`]: gdtId,
      "metadata.ultima_sync_teorica": FieldValue.serverTimestamp(),
    };
    try {
      await visRef.update(visUpdate);
      await ensureEstadoPeriodoLiquidacionAbierto(visRef);
    } catch (e) {
      if (e.code === 5 || (e.message && e.message.includes("NOT_FOUND"))) {
        const dia = {};
        dia[diaKey] = {
          rda_turno_id: esFranco ? null : (capaTeorica.turno_id || capaTeorica.ingreso || capaTeorica.tipo_dia),
          rda_ingreso: esFranco ? null : (capaTeorica.ingreso || null),
          rda_egreso: esFranco ? null : (capaTeorica.egreso || null),
          es_franco: esFranco,
          es_feriado: capaTeorica.es_feriado || false,
          clasificacion_dia_calendario_id: capaTeorica.clasificacion_dia_calendario_id || null,
          tipo_evento_institucional: base.mejorResolucion.tipo_evento || null,
          grupo_de_trabajo_id: gdtId,
        };
        await visRef.set({
          persona_id: personaId,
          anio,
          mes,
          dias: dia,
          estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
          metadata: { ultima_sync_teorica: FieldValue.serverTimestamp() },
        }, { merge: true });
        await ensureEstadoPeriodoLiquidacionAbierto(visRef);
      } else {
        throw e;
      }
    }
  }

  return {
    ok: true,
    diasProcesados: 1,
    fecha: fechaYmd,
    segmentos: capaTeorica.segmentos.length,
    tipo_dia: capaTeorica.tipo_dia,
  };
}

module.exports = {
  materializarTurnoMesBatch,
  materializarGrupoMes,
  materializarTurnoTeoricoDia,
  diasDelMes,
};
