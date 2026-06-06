"use strict";

/**
 * Enriquece agentes[].dias del plan mensual al guardar (foto teórica en borrador).
 * Usa regímenes, calendario institucional y la misma resolución que grilla_aprobada.
 */

const { db } = require("../shared/context");
const { getIndiceCalendario } = require("../shared/calendarService");
const { buildCapaTeoricaSegmentada, ymdHoraToIso } = require("./capaTeoricaSegmentosCore");
const { resolverDiaConPreCarga, diasDelMes } = require("./rdaTurnoTeoricoWorker");
const {
  isoToHhmmInstitucional,
  toHhmmInstitucionalDisplay,
} = require("../shared/horarioInstitucionalDisplay");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const { sanitizarDiasPlanSegunVigenciaHlg, diaFueraVigenciaHlgPlan } = require("./planVigenciaHlg");
const { hlgSegmentosMes, buildFilaId } = require("../shared/hlgSegmentosMes");
const { derivarCargaSemanalDesdeRegimen } = require("../catalogosShared");

const TIPOS_DIA = new Set(["laborable", "guardia", "franco", "no_laborable"]);

function esRegimenDerivado(regimen) {
  const t = String(regimen?.tipo_patron || "").trim();
  return t === "fijo" || t === "rotativo";
}

function esTipoNoTrabajo(tipoDia) {
  const t = normalizarTipoDia(tipoDia);
  return t === "franco" || t === "no_laborable";
}

function esTipoConTurno(tipoDia) {
  const t = normalizarTipoDia(tipoDia);
  return t === "laborable" || t === "guardia";
}

/** Match en turnos_disponibles / dias[] / ciclo[] por horario (cfg fijo sin turno_id). */
function hhmmTurnoSlice(t) {
  const ing = String(t?.ingreso || t?.hora_ingreso || "").trim().slice(0, 5);
  const egr = String(t?.egreso || t?.hora_egreso || "").trim().slice(0, 5);
  return { ing, egr };
}

function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

/** Jornada diurna contenida en catálogo (ej. 08-14 ⊆ 06-14 → M). */
function horarioContenidoEnTurno(ing, egr, ti, te) {
  if (!ing || !egr || !ti || !te) return false;
  if (egr <= ing || te <= ti) return false;
  const a0 = hhmmToMin(ing);
  const a1 = hhmmToMin(egr);
  const b0 = hhmmToMin(ti);
  const b1 = hhmmToMin(te);
  if (a0 < 0 || a1 < 0 || b0 < 0 || b1 < 0) return false;
  return a0 >= b0 && a1 <= b1;
}

function poolTurnosInferenciaDesdeRegimen(regimen) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const { ing, egr } = hhmmTurnoSlice(raw);
    if (!ing) return;
    const key = `${ing}|${egr}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      turno_id: turnoIdValido(raw.turno_id) ? String(raw.turno_id).trim() : null,
      ingreso: ing,
      egreso: egr,
    });
  };
  for (const t of regimen?.turnos_disponibles || []) push(t);
  for (const d of regimen?.dias || []) push(d?.turno);
  for (const p of regimen?.ciclo || []) push(p?.turno);
  return out;
}

function idEstableHorarioRegimen(regimen, ing, egr) {
  const tail = String(regimen?.id || "cfg").trim().slice(-6);
  const hor = `${ing.replace(":", "")}${egr.replace(":", "")}`;
  return `rh${tail}_${hor}`.slice(0, 32);
}

function duracionTurnoMinutos(ti, te) {
  if (!ti || !te || te <= ti) return Number.POSITIVE_INFINITY;
  const d = hhmmToMin(te) - hhmmToMin(ti);
  return d >= 0 ? d : Number.POSITIVE_INFINITY;
}

function elegirTurnoIdContenidoMasCercano(contenidos) {
  let best = null;
  let bestDur = Number.POSITIVE_INFINITY;
  for (const t of contenidos) {
    if (!turnoIdValido(t?.turno_id)) continue;
    const { ing: ti, egr: te } = hhmmTurnoSlice(t);
    const dur = duracionTurnoMinutos(ti, te);
    if (dur < bestDur) {
      bestDur = dur;
      best = t;
    }
  }
  return best ? String(best.turno_id).trim() : null;
}

function inferirTurnoIdEnPool(pool, turnoTeorico) {
  const ing = String(turnoTeorico?.ingreso || turnoTeorico?.hora_ingreso || "").trim().slice(0, 5);
  const egr = String(turnoTeorico?.egreso || turnoTeorico?.hora_egreso || "").trim().slice(0, 5);
  if (!ing || !Array.isArray(pool) || pool.length === 0) return null;

  if (ing && egr) {
    const exactos = pool.filter((t) => {
      const { ing: ti, egr: te } = hhmmTurnoSlice(t);
      return ti === ing && te === egr && turnoIdValido(t.turno_id);
    });
    if (exactos.length === 1) return String(exactos[0].turno_id).trim();

    const contenidos = pool.filter((t) => {
      const { ing: ti, egr: te } = hhmmTurnoSlice(t);
      return turnoIdValido(t.turno_id) && horarioContenidoEnTurno(ing, egr, ti, te);
    });
    if (contenidos.length === 1) return String(contenidos[0].turno_id).trim();
    if (contenidos.length > 1) {
      const pick = elegirTurnoIdContenidoMasCercano(contenidos);
      if (pick) return pick;
    }
  }

  const porIngreso = pool.filter((t) => {
    const { ing: ti } = hhmmTurnoSlice(t);
    return ti === ing && turnoIdValido(t.turno_id);
  });
  if (porIngreso.length === 1) return String(porIngreso[0].turno_id).trim();

  return null;
}

function inferirTurnoIdDesdeRegimen(regimen, turnoTeorico, poolExtra = []) {
  const local = poolTurnosInferenciaDesdeRegimen(regimen);
  const hitLocal = inferirTurnoIdEnPool(local, turnoTeorico);
  if (hitLocal) return hitLocal;

  const hitExtra = inferirTurnoIdEnPool(poolExtra, turnoTeorico);
  if (hitExtra) return hitExtra;

  const ing = String(turnoTeorico?.ingreso || turnoTeorico?.hora_ingreso || "").trim().slice(0, 5);
  const egr = String(turnoTeorico?.egreso || turnoTeorico?.hora_egreso || "").trim().slice(0, 5);
  if (!ing || !egr) return null;

  const mismoHorarioLocal = local.filter((t) => {
    const { ing: ti, egr: te } = hhmmTurnoSlice(t);
    return ti === ing && te === egr;
  });
  if (mismoHorarioLocal.length === 1 && regimen?.id) {
    return idEstableHorarioRegimen(regimen, ing, egr);
  }

  return null;
}

function turnoIdValido(turnoId) {
  if (turnoId == null) return false;
  return String(turnoId).trim() !== "";
}

function horarioInferenciaDesdeRaw(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ing = String(raw.ingreso || raw.hora_ingreso || "").trim();
  const egr = String(raw.egreso || raw.hora_egreso || "").trim();
  if (!ing && !egr) return null;
  return { ingreso: ing || null, egreso: egr || null };
}

function inferirTurnoIdMerge(regimen, res, raw, poolExtra = []) {
  let turno_id = null;
  if (turnoIdValido(res?.turno_teorico?.turno_id)) {
    turno_id = String(res.turno_teorico.turno_id).trim();
  }
  if (!turnoIdValido(turno_id)) {
    turno_id = inferirTurnoIdDesdeRegimen(regimen, res?.turno_teorico, poolExtra);
  }
  if (!turnoIdValido(turno_id)) {
    turno_id = inferirTurnoIdDesdeRegimen(regimen, horarioInferenciaDesdeRaw(raw), poolExtra);
  }
  return turnoIdValido(turno_id) ? String(turno_id).trim() : null;
}

/**
 * R0 integridad: resolución canonical manda; input cliente solo en planificado editable.
 * @returns {{ tipo_dia: string, turno_id: string|null }}
 */
function mergeCeldaPlanConResolucion({ regimen, raw, res, poolExtra = [] }) {
  const resTipo = normalizarTipoDia(res?.tipo_dia);
  const derivado = esRegimenDerivado(regimen);

  if (derivado) {
    const tipo_dia = resTipo;
    if (!esTipoConTurno(tipo_dia)) {
      return { tipo_dia, turno_id: null };
    }
    const turno_id = inferirTurnoIdMerge(regimen, res, raw, poolExtra);
    return { tipo_dia, turno_id };
  }

  // Planificado: calendario / resolución forzada gana sobre input cliente.
  if (esTipoNoTrabajo(resTipo) || res?.es_feriado === true) {
    return { tipo_dia: resTipo, turno_id: null };
  }

  const tipoUsuario = raw?.tipo_dia != null ? normalizarTipoDia(raw.tipo_dia) : null;
  const tipo_dia = tipoUsuario || resTipo;
  if (esTipoNoTrabajo(tipo_dia)) {
    return { tipo_dia, turno_id: null };
  }

  let turno_id =
    raw?.turno_id != null && String(raw.turno_id).trim() !== ""
      ? String(raw.turno_id).trim()
      : null;
  if (!turnoIdValido(turno_id)) {
    turno_id = inferirTurnoIdMerge(regimen, res, raw, poolExtra);
  }
  return { tipo_dia, turno_id: turnoIdValido(turno_id) ? String(turno_id).trim() : null };
}

function normalizarTipoDia(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (TIPOS_DIA.has(t)) return t;
  if (t === "no-laborable" || t === "nolaborable") return "no_laborable";
  return "franco";
}

function hhmmDesdeTurno(turno) {
  if (!turno) return { ingreso: null, egreso: null };
  const ingreso = turno.ingreso || turno.hora_ingreso || null;
  const egreso = turno.egreso || turno.hora_egreso || null;
  return {
    ingreso: ingreso ? String(ingreso).trim().slice(0, 5) : null,
    egreso: egreso ? String(egreso).trim().slice(0, 5) : null,
  };
}

function celdaPlanDesdeResolucion(fechaYmd, res, capa) {
  const tipo = normalizarTipoDia(capa.tipo_dia || res.tipo_dia);
  const esFranco = tipo === "franco" || tipo === "no_laborable";
  const turnoId =
    capa.turno_compuesto_id ||
    res.turno_teorico?.turno_id ||
    null;
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  let ingresoIso = segmentos[0]?.ingreso_iso || null;
  let egresoIso = segmentos.length ? segmentos[segmentos.length - 1].egreso_iso : null;
  const { ingreso: ingHh, egreso: egrHh } = hhmmDesdeTurno(res.turno_teorico);
  let ingreso = esFranco
    ? null
    : toHhmmInstitucionalDisplay(ingHh) ||
      isoToHhmmInstitucional(ingresoIso) ||
      toHhmmInstitucionalDisplay(capa.ingreso) ||
      toHhmmInstitucionalDisplay(capa.ingreso_teorico_final);
  let egreso = esFranco
    ? null
    : toHhmmInstitucionalDisplay(egrHh) ||
      isoToHhmmInstitucional(egresoIso) ||
      toHhmmInstitucionalDisplay(capa.egreso) ||
      toHhmmInstitucionalDisplay(capa.egreso_teorico_final);

  if (!esFranco && ingreso && egreso && !ingresoIso) {
    const cruza =
      res.turno_teorico?.cruza_medianoche === true ||
      String(egreso) <= String(ingreso);
    ingresoIso = ymdHoraToIso(fechaYmd, ingreso, 0);
    egresoIso = ymdHoraToIso(fechaYmd, egreso, cruza ? 1 : 0);
  }

  const esFeriado = capa.es_feriado === true || res.es_feriado === true;

  return {
    tipo_dia: tipo,
    turno_id: esFranco ? null : turnoId,
    ingreso,
    egreso,
    ingreso_iso: esFranco ? null : ingresoIso,
    egreso_iso: esFranco ? null : egresoIso,
    es_feriado: esFeriado,
    tipo_evento_institucional: esFeriado ? res.tipo_evento || "feriado" : null,
  };
}

async function cargarRegimen(regimenId, cache) {
  const id = String(regimenId || "").trim();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  const snap = await db.collection(COL_REGIMEN).doc(id).get();
  const doc = snap.exists ? snap.data() : null;
  if (doc) doc.id = snap.id;
  cache.set(id, doc);
  return doc;
}

/** Paleta con turno_id de todos los regímenes del plan (fijo sin catálogo propio). */
async function construirUnionTurnosDisponiblesPlan(agentesIn, regimenCache) {
  const union = [];
  const seen = new Set();
  for (const ag of agentesIn) {
    if (!ag?.regimen_horario_id) continue;
    const regimen = await cargarRegimen(ag.regimen_horario_id, regimenCache);
    if (!regimen) continue;
    for (const t of regimen.turnos_disponibles || []) {
      if (!turnoIdValido(t?.turno_id)) continue;
      const { ing, egr } = hhmmTurnoSlice(t);
      const key = `${t.turno_id}|${ing}|${egr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      union.push({
        turno_id: String(t.turno_id).trim(),
        ingreso: ing,
        egreso: egr,
      });
    }
  }
  return union;
}

/**
 * @param {{ periodo: string, planId: string, agentes: object[] }} params
 * @returns {Promise<object[]>}
 */
async function enriquecerAgentesDiasPlan({ periodo, planId, agentes }) {
  const agentesIn = Array.isArray(agentes) ? agentes : [];
  if (!periodo || agentesIn.length === 0) return [];

  const [anio, mes] = periodo.split("-").map(Number);
  const ymdsMes = diasDelMes(anio, mes);
  if (ymdsMes.length === 0) return [];

  const indiceCalendario = await getIndiceCalendario();
  const regimenCache = new Map();
  const poolExtra = await construirUnionTurnosDisponiblesPlan(agentesIn, regimenCache);
  const planData = {
    planId: planId || "draft",
    plan: { agentes: agentesIn },
  };
  const agentesOut = [];

  for (const ag of agentesIn) {
    if (!ag?.persona_id || !ag?.regimen_horario_id) continue;
    const regimen = await cargarRegimen(ag.regimen_horario_id, regimenCache);
    if (!regimen) continue;

    let hlg = { regimen_fecha_ancla: ag.regimen_fecha_ancla || null };
    if (ag.hlg_id) {
      const hlgSnap = await db.collection(COL_HLG).doc(ag.hlg_id).get();
      if (hlgSnap.exists) {
        hlg = { id: hlgSnap.id, ...hlgSnap.data() };
      }
    }

    const diasIn = esRegimenDerivado(regimen)
      ? {}
      : sanitizarDiasPlanSegunVigenciaHlg(
          ag.dias && typeof ag.dias === "object" ? ag.dias : {},
          hlg.id ? hlg : null,
        );
    const ymds = esRegimenDerivado(regimen)
      ? ymdsMes
      : [...new Set([...ymdsMes, ...Object.keys(diasIn)])];
    const diasMap = {};

    for (const fechaYmd of ymds) {
      const raw = diasIn[fechaYmd] || {};
      const res = resolverDiaConPreCarga(
        regimen,
        fechaYmd,
        hlg,
        planData,
        ag.persona_id,
        indiceCalendario,
      );

      const { tipo_dia, turno_id: turnoCompuestoId } = mergeCeldaPlanConResolucion({
        regimen,
        raw,
        res,
        poolExtra,
      });

      const capa = buildCapaTeoricaSegmentada({
        fechaYmd,
        personaId: ag.persona_id,
        regimen,
        tipo_dia,
        turnoCompuestoId,
        origen_segmento: "plan_base",
        indiceCalendario,
      });
      if (res.es_feriado) capa.es_feriado = true;

      const celda = celdaPlanDesdeResolucion(
        fechaYmd,
        {
          ...res,
          tipo_dia,
          turno_teorico: turnoCompuestoId
            ? { ...(res.turno_teorico || {}), turno_id: turnoCompuestoId }
            : res.turno_teorico,
        },
        capa,
      );

      if (hlg?.id && diaFueraVigenciaHlgPlan(fechaYmd, hlg)) {
        diasMap[fechaYmd] = {
          tipo_dia: "franco",
          turno_id: null,
          ingreso: null,
          egreso: null,
          ingreso_iso: null,
          egreso_iso: null,
          es_feriado: false,
          tipo_evento_institucional: null,
        };
      } else {
        diasMap[fechaYmd] = celda;
      }
    }

    agentesOut.push({
      persona_id: ag.persona_id,
      regimen_horario_id: ag.regimen_horario_id,
      hlg_id: ag.hlg_id,
      dias: diasMap,
    });
  }

  return agentesOut;
}

function celdaPlanToGrillaAprobada(celdaPlan, capa) {
  const tipo = normalizarTipoDia(celdaPlan.tipo_dia);
  const esFranco = tipo === "franco" || tipo === "no_laborable";
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  return {
    ...celdaPlan,
    tipo_dia: tipo,
    turno_id: esFranco ? null : celdaPlan.turno_id,
    turno_compuesto_id: esFranco ? null : celdaPlan.turno_id,
    es_franco: esFranco,
    clasificacion_dia_calendario_id: capa.clasificacion_dia_calendario_id || null,
    fichadas_esperadas: typeof capa.fichadas_esperadas === "number" ? capa.fichadas_esperadas : null,
    segmentos: segmentos.map((s) => ({
      segmento_id: s.segmento_id,
      ingreso_iso: s.ingreso_iso,
      egreso_iso: s.egreso_iso,
    })),
  };
}

/**
 * Snapshot grilla_aprobada desde la foto ya persistida en plan.agentes[].dias.
 */
async function construirGrillaAprobadaDesdePlanFoto({ plan, planId }) {
  if (!plan || plan.tipo_plan !== "mensual" || !plan.periodo) return null;
  const agentesIn = Array.isArray(plan.agentes) ? plan.agentes : [];
  if (agentesIn.length === 0) return null;

  const agentesEnriquecidos = await enriquecerAgentesDiasPlan({
    periodo: plan.periodo,
    planId: planId || plan.id,
    agentes: agentesIn,
  });
  if (agentesEnriquecidos.length === 0) return null;

  const [anio, mes] = plan.periodo.split("-").map(Number);
  const ymdsMes = diasDelMes(anio, mes);
  const indiceCalendario = await getIndiceCalendario();
  const regimenCache = new Map();
  const poolExtra = await construirUnionTurnosDisponiblesPlan(agentesIn, regimenCache);
  const planData = { planId: planId || plan.id, plan: { agentes: agentesIn } };
  const agentesOut = [];

  for (const agBase of agentesEnriquecidos) {
    const agIn =
      agentesIn.find(
        (a) =>
          a.persona_id === agBase.persona_id &&
          (!agBase.hlg_id || String(a.hlg_id || "") === String(agBase.hlg_id || "")),
      ) || agBase;
    const regimen = await cargarRegimen(agBase.regimen_horario_id, regimenCache);
    if (!regimen) continue;

    let hlg = { regimen_fecha_ancla: agIn.regimen_fecha_ancla || null };
    if (agIn.hlg_id) {
      const hlgSnap = await db.collection(COL_HLG).doc(agIn.hlg_id).get();
      if (hlgSnap.exists) hlg = { id: hlgSnap.id, ...hlgSnap.data() };
    }

    const segmentos = hlgSegmentosMes(
      [
        {
          hlg_id: agIn.hlg_id || agBase.hlg_id,
          persona_id: agBase.persona_id,
          grupo_de_trabajo_id: hlg.grupo_de_trabajo_id || null,
          regimen_horario_id: agBase.regimen_horario_id,
          fecha_inicio: hlg.fecha_inicio || null,
          fecha_fin: hlg.fecha_fin ?? null,
        },
      ],
      anio,
      mes,
    );
    const seg = segmentos[0] || null;

    const diasMap = {};
    for (const fechaYmd of ymdsMes) {
      if (diaFueraVigenciaHlgPlan(fechaYmd, hlg)) continue;
      const celdaPlan = agBase.dias?.[fechaYmd];
      if (!celdaPlan) continue;
      const res = resolverDiaConPreCarga(
        regimen,
        fechaYmd,
        hlg,
        planData,
        agBase.persona_id,
        indiceCalendario,
      );
      const { tipo_dia, turno_id: turnoCompuestoId } = mergeCeldaPlanConResolucion({
        regimen,
        raw: celdaPlan,
        res,
        poolExtra,
      });

      const capa = buildCapaTeoricaSegmentada({
        fechaYmd,
        personaId: agBase.persona_id,
        regimen,
        tipo_dia,
        turnoCompuestoId,
        origen_segmento: "plan_base",
        indiceCalendario,
      });
      if (celdaPlan.es_feriado === true || res.es_feriado) capa.es_feriado = true;

      diasMap[fechaYmd] = celdaPlanToGrillaAprobada(
        celdaPlanDesdeResolucion(
          fechaYmd,
          {
            ...res,
            tipo_dia,
            turno_teorico: turnoCompuestoId
              ? { ...(res.turno_teorico || {}), turno_id: turnoCompuestoId }
              : res.turno_teorico,
          },
          capa,
        ),
        capa,
      );
    }

    agentesOut.push({
      fila_id: seg?.fila_id || buildFilaId(agBase.persona_id, agBase.hlg_id),
      persona_id: agBase.persona_id,
      regimen_horario_id: agBase.regimen_horario_id,
      hlg_id: agBase.hlg_id,
      vigente_desde: seg?.vigente_desde || null,
      vigente_hasta: seg?.vigente_hasta || null,
      carga_horaria_semanal: derivarCargaSemanalDesdeRegimen(regimen),
      dias: diasMap,
    });
  }

  return agentesOut;
}

module.exports = {
  enriquecerAgentesDiasPlan,
  normalizarTipoDia,
  esRegimenDerivado,
  mergeCeldaPlanConResolucion,
  inferirTurnoIdDesdeRegimen,
  celdaPlanDesdeResolucion,
  celdaPlanToGrillaAprobada,
  construirGrillaAprobadaDesdePlanFoto,
};
