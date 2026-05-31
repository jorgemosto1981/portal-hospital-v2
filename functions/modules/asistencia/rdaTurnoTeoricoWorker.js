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
const { resolverCapaTeoricaGrupo } = require("../shared/capaTeoricaPorGrupoCore");
const { getIndiceCalendario } = require("../shared/calendarService");
const { resolverEventoEnIndice } = require("../shared/calendarInstitucionalCore");
const { resolverFijo, resolverRotativo, buildTurnoResponse, ymdToDate, diffDays, isoWeekday } = require("./resolverTurnoDia");
const { buildCapaTeoricaSegmentada } = require("./capaTeoricaSegmentosCore");
const { toHhmmInstitucionalDisplay } = require("../shared/horarioInstitucionalDisplay");
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
 * Acota HLGs al bounded context del materializado (un gdt por batch).
 * @param {Array<object>} hlgs
 * @param {string} grupoId gdt_*
 */
function filtrarHlgsPorGrupo(hlgs, grupoId) {
  const gdt = String(grupoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return [];
  return (hlgs || []).filter((h) => String(h.grupo_de_trabajo_id || "").trim() === gdt);
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

/** E2: overrides acotados al bounded context; legacy sin grupo_de_trabajo_id se ignoran. */
function filtrarOverridesActivosPorGrupo(allOverrides, gdtId) {
  const gdt = String(gdtId || "").trim();
  if (!/^gdt_/i.test(gdt)) return [];
  return (allOverrides || []).filter((o) => {
    if (!esOverrideActivo(o)) return false;
    const og = String(o.grupo_de_trabajo_id || "").trim();
    return og === gdt;
  });
}

function esTipoLaboral(tipoDia) {
  const t = normalizarTipoDiaMaterializacion(tipoDia);
  return t === "laborable" || t === "guardia";
}

function normalizarTipoDiaMaterializacion(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "laborable" || t === "guardia" || t === "franco" || t === "no_laborable") return t;
  if (t === "no-laborable" || t === "nolaborable" || t === "no_laboral") return "no_laborable";
  return "franco";
}

function pickRdaTurnoId(capaTeorica, esFranco) {
  if (esFranco) return null;
  const tid = capaTeorica?.turno_id || capaTeorica?.turno_compuesto_id || null;
  return tid ? String(tid).trim() : null;
}

function esDiaSinTurnoLaboral(tipoDia) {
  return tipoDia === "franco" || tipoDia === "no_laborable";
}

function horariosVisDesdeCapaYTurno({ sinTurnoLaboral, capaTeorica, turnoFinal }) {
  if (sinTurnoLaboral) return { ingreso: null, egreso: null };
  const ingreso = toHhmmInstitucionalDisplay(capaTeorica?.ingreso_teorico_final)
    || toHhmmInstitucionalDisplay(capaTeorica?.ingreso)
    || turnoFinal?.ingreso
    || null;
  const egreso = toHhmmInstitucionalDisplay(capaTeorica?.egreso_teorico_final)
    || toHhmmInstitucionalDisplay(capaTeorica?.egreso)
    || turnoFinal?.egreso
    || null;
  return { ingreso, egreso };
}

/**
 * Escribe slice de capa teórica en capa_teorica_por_grupo[gdt] (T1 dot-path).
 */
function encolarCapaTeoricaPorGrupo(batch, asiRef, asiSnap, gdtId, capaSlice, personaId, fechaYmd) {
  const pathKey = `capa_teorica_por_grupo.${gdtId}`;
  if (asiSnap.exists) {
    batch.update(asiRef, {
      persona_id: personaId,
      fecha: fechaYmd,
      [pathKey]: capaSlice,
    });
  } else {
    batch.set(asiRef, {
      persona_id: personaId,
      fecha: fechaYmd,
      capa_teorica_por_grupo: { [gdtId]: capaSlice },
    });
  }
}

function resolucionDesdeFotoPlan(planBundle, personaId, fechaYmd) {
  const agentes = planBundle?.plan?.agentes;
  if (!Array.isArray(agentes)) return null;
  const ag = agentes.find((a) => a.persona_id === personaId);
  const foto = ag?.dias?.[fechaYmd];
  if (!foto || typeof foto !== "object" || foto.tipo_dia == null) return null;

  const tipo_dia = normalizarTipoDiaMaterializacion(foto.tipo_dia);
  const turnoIdFoto = foto.turno_id != null ? String(foto.turno_id).trim() : "";
  const ingresoFoto = foto.ingreso || foto.ingreso_iso || null;
  const egresoFoto = foto.egreso || foto.egreso_iso || null;
  let turno_teorico = null;
  if (tipo_dia === "laborable" || tipo_dia === "guardia") {
    if (turnoIdFoto || ingresoFoto || egresoFoto) {
      turno_teorico = {
        turno_id: turnoIdFoto || null,
        ingreso: ingresoFoto || null,
        egreso: egresoFoto || null,
      };
    }
  }
  return {
    tipo_dia,
    turno_teorico,
    origen: "plan_mensual",
    plan_id: planBundle.planId || null,
    posicion_ciclo: null,
  };
}

function aplicarFotoPlanDia({ planCache, personaId, fechaYmd, tipoDiaFinal, turnoFinal }) {
  const agentes = planCache?.plan?.agentes;
  if (!Array.isArray(agentes)) return { tipoDiaFinal, turnoFinal };
  const ag = agentes.find((a) => a.persona_id === personaId);
  const foto = ag?.dias?.[fechaYmd];
  if (!foto || typeof foto !== "object") return { tipoDiaFinal, turnoFinal };

  const fotoTipo = foto.tipo_dia != null ? normalizarTipoDiaMaterializacion(foto.tipo_dia) : null;

  // Plan > HLG: la foto del plan protege NL/franco frente a cualquier HLG del batch
  if (fotoTipo === "no_laborable" || fotoTipo === "franco") {
    const turnoIdFoto = foto.turno_id != null ? String(foto.turno_id).trim() : "";
    const ingresoFoto = foto.ingreso || foto.ingreso_iso || null;
    const egresoFoto = foto.egreso || foto.egreso_iso || null;
    let turno = null;
    if (turnoIdFoto || ingresoFoto || egresoFoto) {
      turno = {
        turno_id: turnoIdFoto || null,
        ingreso: ingresoFoto || null,
        egreso: egresoFoto || null,
      };
    }
    return { tipoDiaFinal: fotoTipo, turnoFinal: turno };
  }

  const tipo = fotoTipo || normalizarTipoDiaMaterializacion(tipoDiaFinal);
  let turno = turnoFinal;
  const turnoIdFoto = foto.turno_id != null ? String(foto.turno_id).trim() : "";
  const ingresoFoto = foto.ingreso || foto.ingreso_iso || null;
  const egresoFoto = foto.egreso || foto.egreso_iso || null;
  if (turnoIdFoto || ingresoFoto || egresoFoto) {
    turno = {
      ...(turno || {}),
      turno_id: turnoIdFoto || turno?.turno_id || null,
      ingreso: ingresoFoto || turno?.ingreso,
      egreso: egresoFoto || turno?.egreso,
      cruza_medianoche: turno?.cruza_medianoche,
    };
  }
  return { tipoDiaFinal: tipo, turnoFinal: turno };
}

async function ensureEstadoPeriodoLiquidacionAbierto(visRef) {
  const snap = await visRef.get();
  if (!snap.exists) return;
  const estado = snap.data()?.estado_periodo_liquidacion_id ?? null;
  if (estado == null || String(estado).trim() === "") {
    await visRef.set({ estado_periodo_liquidacion_id: CFG_EPL_ABIERTO }, { merge: true });
  }
}

async function resolverBaseDiaPersona({ personaId, fechaYmd, indiceCalendario, grupoId }) {
  const gdt = String(grupoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return null;

  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const hlgs = filtrarHlgsPorGrupo(
    await obtenerHlgsVigentesParaMes(personaId, fechaYmd, fechaYmd),
    gdt,
  );
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
    if (regimen.tipo_patron === "planificado") {
      plan = await obtenerPlanHabilitado(gdt, periodoId);
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

  let tipoDiaFinal = mejorResolucion.tipo_dia;
  let turnoFinal = mejorResolucion.turno_teorico;
  const planCacheFoto = hlgContextos.find((c) => c.plan) || null;
  if (planCacheFoto) {
    const merged = aplicarFotoPlanDia({
      planCache: planCacheFoto,
      personaId,
      fechaYmd,
      tipoDiaFinal,
      turnoFinal,
    });
    tipoDiaFinal = merged.tipoDiaFinal;
    turnoFinal = merged.turnoFinal;
  }

  const capaBase = buildCapaTeoricaSegmentada({
    fechaYmd,
    personaId,
    regimen: regimenDoc,
    tipo_dia: tipoDiaFinal,
    turnoCompuestoId: turnoFinal?.turno_id || turnoCompuestoId,
    origen_segmento: "plan_base",
    indiceCalendario,
  });

  return {
    capaBase,
    mejorResolucion: { ...mejorResolucion, tipo_dia: tipoDiaFinal, turno_teorico: turnoFinal },
    mejorHlg,
    regimenDoc,
    planCache: planCacheFoto,
  };
}

function upsertSegmento(segmentos, segmentoNuevo) {
  const idx = segmentos.findIndex((s) => s.segmento_id === segmentoNuevo.segmento_id
    && s.persona_titular_id === segmentoNuevo.persona_titular_id
    && s.persona_ejecutante_id === segmentoNuevo.persona_ejecutante_id);
  if (idx >= 0) segmentos[idx] = segmentoNuevo;
  else segmentos.push(segmentoNuevo);
}

async function listarCoberturasDia(fechaYmd, personaId, grupoId) {
  const gdt = String(grupoId || "").trim();
  const snap = await db.collection(COL_ASISTENCIA).where("fecha", "==", fechaYmd).get();
  const out = [];
  for (const doc of snap.docs) {
    const all = Array.isArray(doc.data()?.overrides_turno) ? doc.data().overrides_turno : [];
    for (const ov of all) {
      if (!esOverrideActivo(ov)) continue;
      if (ov.tipo !== "cobertura_parcial") continue;
      if (gdt) {
        const og = String(ov.grupo_de_trabajo_id || "").trim();
        if (og !== gdt) continue;
      }
      if (ov.persona_origen_id === personaId || ov.persona_cobertura_id === personaId) out.push(ov);
    }
  }
  return out;
}

async function aplicarCoberturasParciales({ personaId, fechaYmd, segmentos, coberturas, indiceCalendario, grupoId }) {
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
      grupoId,
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
      resolucion = {
        ...r,
        tipo_dia: normalizarTipoDiaMaterializacion(r.tipo_dia),
        origen: "regimen_fijo",
        plan_id: null,
        posicion_ciclo: null,
      };
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
          tipo_dia: normalizarTipoDiaMaterializacion(posConf.tipo_dia),
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
 * Materializa turno teórico para 1 agente × 1 mes en un bounded context (gdt).
 *
 * Solo HLGs con grupo_de_trabajo_id === grupoId. Plan > HLG cuando hay planCache del grupo.
 *
 * @param {object} params
 * @param {string} params.personaId
 * @param {string} params.grupoId gdt_* — obligatorio
 * @param {number} params.anio
 * @param {number} params.mes
 * @param {object} [params.regimenCache] - Map<regimenId, regimenDoc> para dedup
 * @param {object} [params.planCache] - { planId, plan } pre-cargado del grupo
 * @returns {Promise<{ ok: boolean, diasProcesados: number, error?: string }>}
 */
async function materializarTurnoMesBatch({ personaId, grupoId: _grupoId, anio, mes, regimenCache, planCache, etiquetaGrupoCache }) {
  const gdt = String(_grupoId || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return { ok: false, diasProcesados: 0, error: "grupoId (gdt_*) requerido" };
  }

  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const dias = diasDelMes(anio, mes);
  if (dias.length === 0) return { ok: false, diasProcesados: 0, error: "Mes inválido" };

  const primerDia = dias[0];
  const ultimoDia = dias[dias.length - 1];
  const regCache = regimenCache || new Map();
  const etqCache = etiquetaGrupoCache || new Map();
  const planBundle = planCache?.plan ? planCache : null;

  await resolverEtiquetaGrupo(etqCache, gdt);
  if (planBundle?.plan?.grupo_id) await resolverEtiquetaGrupo(etqCache, planBundle.plan.grupo_id);

  const hlgs = filtrarHlgsPorGrupo(
    await obtenerHlgsVigentesParaMes(personaId, primerDia, ultimoDia),
    gdt,
  );
  if (hlgs.length === 0) {
    return { ok: true, diasProcesados: 0, error: "Sin HLG vigente en el grupo" };
  }

  const indiceCalendario = await getIndiceCalendario();

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
    const plan = planBundle
      || (regimen.tipo_patron === "planificado" ? await obtenerPlanHabilitado(gdt, periodoId) : null);
    hlgContextos.push({ hlg, regimen, plan });
  }

  if (hlgContextos.length === 0) {
    return { ok: true, diasProcesados: 0, error: "Sin HLG con régimen válido en el grupo" };
  }

  const batch = db.batch();
  const visDias = {};
  let diasProcesados = 0;

  for (const fechaYmd of dias) {
    let mejorResolucion = resolucionDesdeFotoPlan(planBundle, personaId, fechaYmd);
    let mejorHlg = null;

    if (!mejorResolucion) {
      for (const { hlg, regimen, plan } of hlgContextos) {
        const fi = hlg.fecha_inicio || "";
        const ff = hlg.fecha_fin || "";
        if (fi && fi > fechaYmd) continue;
        if (ff && ff < fechaYmd) continue;

        const res = resolverDiaConPreCarga(regimen, fechaYmd, hlg, plan, personaId, indiceCalendario);
        const esLaboral = esTipoLaboral(res.tipo_dia);
        if (!mejorResolucion) {
          mejorResolucion = res;
          mejorHlg = hlg;
        } else if (esLaboral && !esTipoLaboral(mejorResolucion.tipo_dia)) {
          mejorResolucion = res;
          mejorHlg = hlg;
        }
      }
    } else {
      const ctx = hlgContextos.find((c) => {
        const fi = c.hlg.fecha_inicio || "";
        const ff = c.hlg.fecha_fin || "";
        if (fi && fi > fechaYmd) return false;
        if (ff && ff < fechaYmd) return false;
        return true;
      });
      mejorHlg = ctx?.hlg || hlgContextos[0]?.hlg;
    }

    if (!mejorResolucion || !mejorHlg) continue;

    const asiDocId = buildAsiDocumentId(personaId, fechaYmd);
    if (!asiDocId) continue;
    const asiRef = db.collection(COL_ASISTENCIA).doc(asiDocId);
    const asiSnap = await asiRef.get();
    const overrides = filtrarOverridesActivosPorGrupo(
      asiSnap.exists ? asiSnap.data().overrides_turno : [],
      gdt,
    ).filter((o) => o.tipo === "reemplazo");

    let turnoFinal = mejorResolucion.turno_teorico;
    let origenFinal = mejorResolucion.origen;
    let tipoDiaFinal = normalizarTipoDiaMaterializacion(mejorResolucion.tipo_dia);
    const planCacheFoto = planBundle || hlgContextos.find((c) => c.plan) || null;
    if (planCacheFoto && mejorResolucion.origen !== "plan_mensual") {
      const merged = aplicarFotoPlanDia({
        planCache: planCacheFoto,
        personaId,
        fechaYmd,
        tipoDiaFinal,
        turnoFinal,
      });
      tipoDiaFinal = normalizarTipoDiaMaterializacion(merged.tipoDiaFinal);
      turnoFinal = merged.turnoFinal;
    }
    if (overrides.length > 0) {
      const ultimo = overrides[overrides.length - 1];
      turnoFinal = buildTurnoResponse(ultimo.turno || ultimo);
      origenFinal = "override";
      tipoDiaFinal = ultimo.tipo_dia || "laborable";
    }

    const regimenDoc = regCache.get(mejorHlg.regimen_horario_id) || {};
    let turnoCompuestoId = turnoFinal?.turno_id || null;
    const fotoDiaPlan = planCacheFoto?.plan?.agentes?.find((a) => a.persona_id === personaId)?.dias?.[fechaYmd];
    if (!turnoCompuestoId && fotoDiaPlan?.turno_id) {
      turnoCompuestoId = String(fotoDiaPlan.turno_id).trim();
    }
    if (!turnoCompuestoId && (turnoFinal?.ingreso || turnoFinal?.egreso)) {
      turnoCompuestoId = "plan_horario";
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

    const gdtOperativo = gdt;

    const capaSlice = {
      ...capaSegmentada,
      es_nocturno: turnoFinal?.es_nocturno || false,
      origen: origenFinal,
      regimen_horario_id: planCacheFoto?.plan?.agentes?.find((a) => a.persona_id === personaId)?.regimen_horario_id
        || mejorHlg.regimen_horario_id,
      hlg_id: mejorHlg.id,
      grupo_de_trabajo_id: gdtOperativo,
      plan_id: mejorResolucion.plan_id || planBundle?.planId || null,
      posicion_ciclo: mejorResolucion.posicion_ciclo ?? null,
      materializado_en: new Date().toISOString(),
    };

    encolarCapaTeoricaPorGrupo(batch, asiRef, asiSnap, gdt, capaSlice, personaId, fechaYmd);

    const diaKey = diaMesKeyDesdeYmd(fechaYmd);
    let tipoDiaVis = normalizarTipoDiaMaterializacion(tipoDiaFinal);
    const esFeriadoInst = capaSlice.es_feriado === true;
    const fotoTipoPlan =
      fotoDiaPlan?.tipo_dia != null ? normalizarTipoDiaMaterializacion(fotoDiaPlan.tipo_dia) : null;
    const jornadaDesdePlanFoto =
      fotoDiaPlan &&
      (fotoTipoPlan === "laborable" || fotoTipoPlan === "guardia") &&
      Boolean(
        String(fotoDiaPlan.turno_id || "").trim() ||
          fotoDiaPlan.ingreso ||
          fotoDiaPlan.ingreso_iso ||
          fotoDiaPlan.egreso ||
          fotoDiaPlan.egreso_iso,
      );
    const jornadaResuelta =
      (tipoDiaVis === "laborable" || tipoDiaVis === "guardia") &&
      Boolean(
        turnoFinal?.turno_id ||
          fotoDiaPlan?.turno_id ||
          turnoFinal?.ingreso ||
          turnoFinal?.egreso,
      );
    if (esFeriadoInst && jornadaDesdePlanFoto) {
      tipoDiaVis = fotoTipoPlan === "guardia" ? "guardia" : "laborable";
    } else if (esFeriadoInst && (tipoDiaVis === "laborable" || tipoDiaVis === "guardia") && !jornadaResuelta) {
      tipoDiaVis = "no_laborable";
    }
    const sinTurnoLaboral = esDiaSinTurnoLaboral(tipoDiaVis);
    const { ingreso: rdaIngreso, egreso: rdaEgreso } = horariosVisDesdeCapaYTurno({
      sinTurnoLaboral,
      capaTeorica: capaSlice,
      turnoFinal,
    });
    visDias[`dias.${diaKey}.rda_turno_id`] = pickRdaTurnoId(capaSlice, sinTurnoLaboral);
    visDias[`dias.${diaKey}.rda_ingreso`] = rdaIngreso;
    visDias[`dias.${diaKey}.rda_egreso`] = rdaEgreso;
    visDias[`dias.${diaKey}.tipo_dia`] = tipoDiaVis;
    visDias[`dias.${diaKey}.es_franco`] = tipoDiaVis === "franco";
    visDias[`dias.${diaKey}.es_feriado`] = capaSlice.es_feriado || false;
    visDias[`dias.${diaKey}.clasificacion_dia_calendario_id`] = capaSlice.clasificacion_dia_calendario_id || null;
    visDias[`dias.${diaKey}.tipo_evento_institucional`] = mejorResolucion.tipo_evento || null;
    visDias[`dias.${diaKey}.grupo_de_trabajo_id`] = gdtOperativo;
    visDias[`dias.${diaKey}.etiqueta_grupo_corta`] = etqCache.get(gdtOperativo) || gdtOperativo;

    diasProcesados++;
  }

  if (diasProcesados === 0) return { ok: true, diasProcesados: 0 };

  await batch.commit();

  const visDocId = buildVisDocumentId(personaId, `${anio}-${String(mes).padStart(2, "0")}-01`, gdt);
  if (visDocId) {
    const visRef = db.collection(COL_VIS).doc(visDocId);
    const visUpdateData = {
      ...visDias,
      persona_id: personaId,
      anio,
      mes,
      grupo_de_trabajo_id: gdt,
      "metadata.ultima_sync_teorica": FieldValue.serverTimestamp(),
      "metadata.version_token": FieldValue.serverTimestamp(),
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
          grupo_de_trabajo_id: gdt,
          dias: nestedDias,
          estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
          metadata: {
            ultima_sync_teorica: FieldValue.serverTimestamp(),
            version_token: FieldValue.serverTimestamp(),
          },
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
async function materializarGrupoMes({ grupoId, anio, mes, planCache: planCacheIn }) {
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

  let planCache = planCacheIn || null;
  if (!planCache) {
    const tienesPlanificado = agentes.some((a) => {
      const reg = regimenCache.get(a.regimenId);
      return reg?.tipo_patron === "planificado";
    });
    if (tienesPlanificado) {
      planCache = await obtenerPlanHabilitado(grupoId, periodoId);
    }
  }

  const etiquetaGrupoCache = new Map();
  if (grupoId) await resolverEtiquetaGrupo(etiquetaGrupoCache, grupoId);
  if (planCacheIn?.plan?.grupo_id) await resolverEtiquetaGrupo(etiquetaGrupoCache, planCacheIn.plan.grupo_id);

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
  const gdt = String(grupoId || "").trim();
  if (!/^gdt_/i.test(gdt)) {
    return { ok: false, diasProcesados: 0, error: "grupoId (gdt_*) requerido" };
  }

  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const indiceCalendario = await getIndiceCalendario();
  const base = await resolverBaseDiaPersona({ personaId, fechaYmd, indiceCalendario, grupoId: gdt });
  if (!base) return { ok: true, diasProcesados: 0, error: "Sin HLG vigente para fecha en el grupo" };

  const asiDocId = buildAsiDocumentId(personaId, fechaYmd);
  if (!asiDocId) return { ok: false, diasProcesados: 0, error: "DocId asistencia inválido" };
  const asiRef = db.collection(COL_ASISTENCIA).doc(asiDocId);
  const asiSnap = await asiRef.get();
  const allOverrides = asiSnap.exists && Array.isArray(asiSnap.data().overrides_turno)
    ? asiSnap.data().overrides_turno
    : [];
  const activos = filtrarOverridesActivosPorGrupo(allOverrides, gdt);

  const reemplazos = activos.filter((o) => o.tipo === "reemplazo");
  const adicionales = activos.filter((o) => o.tipo === "adicional");
  const coberturas = await listarCoberturasDia(fechaYmd, personaId, gdt);

  let turnoCompuestoId = base.mejorResolucion.turno_teorico?.turno_id || base.capaBase.turno_compuesto_id || null;
  let tipoDiaFinal = base.capaBase.tipo_dia || base.mejorResolucion.tipo_dia;
  if (reemplazos.length > 0) {
    const ultimo = reemplazos[reemplazos.length - 1];
    turnoCompuestoId = ultimo.turno_id || turnoCompuestoId;
    tipoDiaFinal = ultimo.tipo_dia || "laborable";
  }

  let segmentos = [];
  if (turnoCompuestoId && !esDiaSinTurnoLaboral(tipoDiaFinal)) {
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
    grupoId: gdt,
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

  const planEntry = base.planCache;
  const capaSlice = {
    ...capaSegmentada,
    es_nocturno: false,
    origen: reemplazos.length > 0 ? "override" : base.mejorResolucion.origen,
    regimen_horario_id: planEntry?.plan?.agentes?.find((a) => a.persona_id === personaId)?.regimen_horario_id
      || base.mejorHlg.regimen_horario_id,
    hlg_id: base.mejorHlg.id,
    grupo_de_trabajo_id: gdt,
    plan_id: base.mejorResolucion.plan_id || planEntry?.planId || null,
    posicion_ciclo: base.mejorResolucion.posicion_ciclo ?? null,
    materializado_en: new Date().toISOString(),
  };

  const batch = db.batch();
  encolarCapaTeoricaPorGrupo(batch, asiRef, asiSnap, gdt, capaSlice, personaId, fechaYmd);
  await batch.commit();

  const capaEscrita = resolverCapaTeoricaGrupo(
    { capa_teorica_por_grupo: { [gdt]: capaSlice } },
    gdt,
  ) || capaSlice;

  const etqCache = new Map();
  await resolverEtiquetaGrupo(etqCache, gdt);

  const visDocId = buildVisDocumentId(personaId, `${periodoId}-01`, gdt);
  if (visDocId) {
    const diaKey = diaMesKeyDesdeYmd(fechaYmd);
    const sinTurnoLaboral = esDiaSinTurnoLaboral(capaEscrita.tipo_dia);
    const { ingreso: rdaIngreso, egreso: rdaEgreso } = horariosVisDesdeCapaYTurno({
      sinTurnoLaboral,
      capaTeorica: capaEscrita,
      turnoFinal: base.mejorResolucion.turno_teorico,
    });
    let tipoDiaVis = capaEscrita.tipo_dia;
    if (capaEscrita.es_feriado === true && (tipoDiaVis === "laborable" || tipoDiaVis === "guardia")) {
      tipoDiaVis = "no_laborable";
    }
    const visRef = db.collection(COL_VIS).doc(visDocId);
    const visUpdate = {
      [`dias.${diaKey}.rda_turno_id`]: pickRdaTurnoId(capaEscrita, sinTurnoLaboral),
      [`dias.${diaKey}.rda_ingreso`]: rdaIngreso,
      [`dias.${diaKey}.rda_egreso`]: rdaEgreso,
      [`dias.${diaKey}.tipo_dia`]: tipoDiaVis,
      [`dias.${diaKey}.es_franco`]: tipoDiaVis === "franco",
      [`dias.${diaKey}.es_feriado`]: capaEscrita.es_feriado || false,
      [`dias.${diaKey}.clasificacion_dia_calendario_id`]: capaEscrita.clasificacion_dia_calendario_id || null,
      [`dias.${diaKey}.tipo_evento_institucional`]: base.mejorResolucion.tipo_evento || null,
      [`dias.${diaKey}.grupo_de_trabajo_id`]: gdt,
      [`dias.${diaKey}.etiqueta_grupo_corta`]: etqCache.get(gdt) || gdt,
      persona_id: personaId,
      anio,
      mes,
      grupo_de_trabajo_id: gdt,
      "metadata.ultima_sync_teorica": FieldValue.serverTimestamp(),
      "metadata.version_token": FieldValue.serverTimestamp(),
    };
    try {
      await visRef.update(visUpdate);
      await ensureEstadoPeriodoLiquidacionAbierto(visRef);
    } catch (e) {
      if (e.code === 5 || (e.message && e.message.includes("NOT_FOUND"))) {
        const dia = {};
        dia[diaKey] = {
          rda_turno_id: pickRdaTurnoId(capaEscrita, sinTurnoLaboral),
          rda_ingreso: rdaIngreso,
          rda_egreso: rdaEgreso,
          tipo_dia: tipoDiaVis,
          es_franco: tipoDiaVis === "franco",
          es_feriado: capaEscrita.es_feriado || false,
          clasificacion_dia_calendario_id: capaEscrita.clasificacion_dia_calendario_id || null,
          tipo_evento_institucional: base.mejorResolucion.tipo_evento || null,
          grupo_de_trabajo_id: gdt,
          etiqueta_grupo_corta: etqCache.get(gdt) || gdt,
        };
        await visRef.set({
          persona_id: personaId,
          anio,
          mes,
          grupo_de_trabajo_id: gdt,
          dias: dia,
          estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
          metadata: {
            ultima_sync_teorica: FieldValue.serverTimestamp(),
            version_token: FieldValue.serverTimestamp(),
          },
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
    segmentos: capaEscrita.segmentos?.length || 0,
    tipo_dia: capaEscrita.tipo_dia,
  };
}

module.exports = {
  materializarTurnoMesBatch,
  materializarGrupoMes,
  materializarTurnoTeoricoDia,
  diasDelMes,
  resolverDiaConPreCarga,
  normalizarTipoDiaMaterializacion,
};
