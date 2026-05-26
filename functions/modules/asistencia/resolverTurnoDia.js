"use strict";

/**
 * resolverTurnoDia — Motor de resolución bajo demanda del turno teórico de un agente para un día.
 *
 * Cadena de prioridad:
 *   1. Overrides manuales (asistencia_diaria.overrides_turno[])
 *   2. Plan mensual habilitado (planes_turno_servicio, patrón planificado)
 *   3. Cálculo directo desde régimen (fijo: día semana, rotativo: módulo aritmético)
 *   4. Cruce con calendario institucional (feriados/asuetos)
 *
 * Contrato de salida unificado: ver JSDoc de resolverTurnoDia().
 */

const { db } = require("../shared/context");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_ASISTENCIA = "asistencia_diaria";
const COL_PLANES = "planes_turno_servicio";
const COL_CAL_CONFIG = "config";
const CAL_DOC_ID = "calendario_institucional";
const CAL_SUB = "eventos";

/**
 * Convierte "YYYY-MM-DD" a Date UTC.
 * @param {string} ymd
 * @returns {Date}
 */
function ymdToDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * ISO weekday: 1=lunes ... 7=domingo (ISO 8601).
 * @param {Date} date
 * @returns {number}
 */
function isoWeekday(date) {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

/**
 * Diferencia en días (entero, puede ser negativo).
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function diffDays(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * Determina si un turno cruza medianoche (egreso < ingreso en HH:MM).
 * @param {{ ingreso: string, egreso: string }} turno
 * @returns {boolean}
 */
function cruzaMedianoche(turno) {
  if (!turno || !turno.ingreso || !turno.egreso) return false;
  return turno.egreso <= turno.ingreso && turno.egreso !== "00:00";
}

/**
 * Construye el bloque de respuesta para un turno.
 * @param {object} turno
 * @returns {object}
 */
function buildTurnoResponse(turno) {
  if (!turno) return null;
  return {
    ingreso: turno.ingreso,
    egreso: turno.egreso,
    horas_efectivas: turno.horas_efectivas,
    es_nocturno: turno.es_nocturno === true,
    cruza_medianoche: cruzaMedianoche(turno),
    tolerancia_ingreso_min: turno.tolerancia_ingreso_min || 0,
    tolerancia_egreso_min: turno.tolerancia_egreso_min || 0,
    banda_ingreso: turno.banda_ingreso || null,
    banda_egreso: turno.banda_egreso || null,
    descanso: turno.descanso || null,
  };
}

/**
 * Resuelve el turno para un patrón FIJO según el día de la semana.
 * @param {object} regimen
 * @param {Date} fechaDate
 * @returns {{ tipo_dia: string, turno_teorico: object|null }}
 */
function resolverFijo(regimen, fechaDate) {
  const weekday = isoWeekday(fechaDate);
  const diaConf = (regimen.dias || []).find((d) => d.dia_semana === weekday);
  if (!diaConf) return { tipo_dia: "no_laborable", turno_teorico: null };
  return {
    tipo_dia: diaConf.tipo_dia,
    turno_teorico: buildTurnoResponse(diaConf.turno),
  };
}

/**
 * Resuelve el turno para un patrón ROTATIVO según fecha ancla + módulo aritmético.
 * @param {object} regimen
 * @param {Date} fechaDate
 * @param {string} fechaAnclaYmd
 * @returns {{ tipo_dia: string, turno_teorico: object|null, posicion_ciclo: number }}
 */
function resolverRotativo(regimen, fechaDate, fechaAnclaYmd) {
  if (!fechaAnclaYmd) {
    return { tipo_dia: "no_laborable", turno_teorico: null, posicion_ciclo: 0 };
  }
  const ancla = ymdToDate(fechaAnclaYmd);
  const diff = diffDays(ancla, fechaDate);
  const cicloTotal = regimen.ciclo_total || regimen.ciclo.length;
  const posRaw = ((diff % cicloTotal) + cicloTotal) % cicloTotal;
  const posicion = posRaw + 1;

  const posConf = (regimen.ciclo || []).find((p) => p.posicion === posicion);
  if (!posConf) return { tipo_dia: "no_laborable", turno_teorico: null, posicion_ciclo: posicion };
  return {
    tipo_dia: posConf.tipo_dia,
    turno_teorico: buildTurnoResponse(posConf.turno),
    posicion_ciclo: posicion,
  };
}

/**
 * Resuelve el turno para un patrón PLANIFICADO consultando el plan mensual habilitado.
 * @param {object} regimen
 * @param {string} fechaYmd
 * @param {string} grupoId
 * @param {string} personaId
 * @returns {Promise<{ tipo_dia: string, turno_teorico: object|null, plan_id: string|null }>}
 */
async function resolverPlanificado(regimen, fechaYmd, grupoId, personaId) {
  if (!grupoId) return { tipo_dia: "no_laborable", turno_teorico: null, plan_id: null };

  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;

  const planSnap = await db
    .collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodoId)
    .where("estado", "==", "HABILITADO")
    .limit(1)
    .get();

  if (planSnap.empty) return { tipo_dia: "no_laborable", turno_teorico: null, plan_id: null };

  const plan = planSnap.docs[0].data();
  const planId = planSnap.docs[0].id;
  const agentePlan = (plan.agentes || []).find((a) => a.persona_id === personaId);
  const asignacionDia = agentePlan?.dias?.[fechaYmd];

  if (!asignacionDia || asignacionDia.tipo_dia === "franco") {
    return { tipo_dia: asignacionDia?.tipo_dia || "franco", turno_teorico: null, plan_id: planId };
  }

  const turnoId = asignacionDia.turno_id;
  const turnoDisp = (regimen.turnos_disponibles || []).find((t) => t.turno_id === turnoId);
  if (!turnoDisp) {
    return { tipo_dia: asignacionDia.tipo_dia || "laborable", turno_teorico: null, plan_id: planId };
  }

  return {
    tipo_dia: asignacionDia.tipo_dia || "laborable",
    turno_teorico: buildTurnoResponse(turnoDisp),
    plan_id: planId,
  };
}

/**
 * Consulta overrides manuales del día en asistencia_diaria.
 * @param {string} personaId
 * @param {string} fechaYmd
 * @returns {Promise<object[]>}
 */
async function consultarOverrides(personaId, fechaYmd) {
  const docId = `asi_${personaId}_${fechaYmd.replace(/-/g, "")}`;
  const snap = await db.collection(COL_ASISTENCIA).doc(docId).get();
  if (!snap.exists) return [];
  const data = snap.data();
  return Array.isArray(data.overrides_turno) ? data.overrides_turno : [];
}

/**
 * Consulta si la fecha es feriado/asueto en el calendario institucional.
 * @param {string} fechaYmd
 * @returns {Promise<{ es_feriado: boolean, evento_calendario_id: string|null, tipo_evento: string|null, multiplicador: number }>}
 */
async function consultarCalendario(fechaYmd) {
  const snap = await db
    .collection(COL_CAL_CONFIG)
    .doc(CAL_DOC_ID)
    .collection(CAL_SUB)
    .doc(fechaYmd)
    .get();

  if (!snap.exists) return { es_feriado: false, evento_calendario_id: null, tipo_evento: null, multiplicador: 1 };
  const ev = snap.data();
  return {
    es_feriado: true,
    evento_calendario_id: fechaYmd,
    tipo_evento: ev.tipo || "feriado",
    multiplicador: typeof ev.multiplicador === "number" ? ev.multiplicador : 1,
  };
}

/**
 * Obtiene HLg vigente para persona+fecha (y opcionalmente grupo).
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} [grupoId]
 * @returns {Promise<object|null>}
 */
async function obtenerHlgVigente(personaId, fechaYmd, grupoId) {
  let q = db.collection(COL_HLG).where("persona_id", "==", personaId).where("activo", "==", true);
  if (grupoId) q = q.where("grupo_de_trabajo_id", "==", grupoId);
  const snap = await q.get();
  if (snap.empty) return null;

  for (const doc of snap.docs) {
    const d = doc.data();
    const fi = d.fecha_inicio || "";
    const ff = d.fecha_fin || "";
    if (fi && fi > fechaYmd) continue;
    if (ff && ff < fechaYmd) continue;
    return { id: doc.id, ...d };
  }
  return null;
}

/**
 * Punto de entrada principal.
 *
 * @param {object} params
 * @param {string} params.personaId
 * @param {string} params.fecha — "YYYY-MM-DD"
 * @param {string} [params.grupoId] — filtro opcional de grupo
 * @returns {Promise<ResolverTurnoDiaResult>}
 *
 * @typedef {object} ResolverTurnoDiaResult
 * @property {string} tipo_dia — "laborable"|"guardia"|"no_laborable"|"franco"
 * @property {object|null} turno_teorico — bloque de turno enriquecido
 * @property {object[]} overrides — array de overrides manuales del día
 * @property {number} horas_efectivas_total — suma de horas teóricas + adicionales
 * @property {boolean} es_feriado
 * @property {string|null} evento_calendario_id
 * @property {string|null} tipo_evento_calendario
 * @property {number} multiplicador_feriado
 * @property {boolean} es_dia_laborable — true si tipo_dia in (laborable, guardia)
 * @property {string} origen — "override"|"plan_mensual"|"regimen_fijo"|"regimen_rotativo"|"sin_regimen"
 * @property {string|null} regimen_horario_id
 * @property {string|null} hlg_id
 * @property {string|null} plan_id — ID del plan mensual (solo planificado)
 * @property {number|null} posicion_ciclo — posición en ciclo (solo rotativo)
 */
async function resolverTurnoDia({ personaId, fecha, grupoId }) {
  const fechaYmd = String(fecha || "").trim();
  if (!personaId || !fechaYmd || !/^\d{4}-\d{2}-\d{2}$/.test(fechaYmd)) {
    return buildResultadoVacio("sin_regimen", "Parámetros inválidos");
  }

  const [hlg, overrides, cal] = await Promise.all([
    obtenerHlgVigente(personaId, fechaYmd, grupoId),
    consultarOverrides(personaId, fechaYmd),
    consultarCalendario(fechaYmd),
  ]);

  if (!hlg || !hlg.regimen_horario_id) {
    return buildResultado({
      tipo_dia: "no_laborable",
      turno_teorico: null,
      overrides,
      origen: "sin_regimen",
      ...cal,
      hlg_id: hlg?.id || null,
      regimen_horario_id: null,
    });
  }

  const regimenSnap = await db.collection(COL_REGIMEN).doc(hlg.regimen_horario_id).get();
  if (!regimenSnap.exists) {
    return buildResultado({
      tipo_dia: "no_laborable",
      turno_teorico: null,
      overrides,
      origen: "sin_regimen",
      ...cal,
      hlg_id: hlg.id,
      regimen_horario_id: hlg.regimen_horario_id,
    });
  }

  const regimen = regimenSnap.data();
  const fechaDate = ymdToDate(fechaYmd);
  let resolucion;

  switch (regimen.tipo_patron) {
    case "fijo": {
      const r = resolverFijo(regimen, fechaDate);
      resolucion = { ...r, origen: "regimen_fijo", plan_id: null, posicion_ciclo: null };
      break;
    }
    case "rotativo": {
      const r = resolverRotativo(regimen, fechaDate, hlg.regimen_fecha_ancla);
      resolucion = { ...r, origen: "regimen_rotativo", plan_id: null };
      break;
    }
    case "planificado": {
      const r = await resolverPlanificado(regimen, fechaYmd, hlg.grupo_de_trabajo_id, personaId);
      resolucion = { ...r, origen: "plan_mensual", posicion_ciclo: null };
      break;
    }
    default:
      resolucion = { tipo_dia: "no_laborable", turno_teorico: null, origen: "sin_regimen", plan_id: null, posicion_ciclo: null };
  }

  if (cal.es_feriado && regimen.impacta_calendario_institucional !== false) {
    const esLaborable = resolucion.tipo_dia === "laborable" || resolucion.tipo_dia === "guardia";
    if (esLaborable) {
      resolucion.tipo_dia = "no_laborable";
      resolucion.turno_teorico = null;
    }
  }

  const overridesReemplazo = overrides.filter((o) => o.tipo === "reemplazo" && !o.invalidado_por_replanificacion);
  const overridesAdicional = overrides.filter((o) => o.tipo === "adicional" && !o.invalidado_por_replanificacion);

  let turnoFinal = resolucion.turno_teorico;
  let origenFinal = resolucion.origen;
  if (overridesReemplazo.length > 0) {
    const ultimo = overridesReemplazo[overridesReemplazo.length - 1];
    turnoFinal = buildTurnoResponse(ultimo.turno || ultimo);
    origenFinal = "override";
    resolucion.tipo_dia = ultimo.tipo_dia || "laborable";
  }

  const horasBase = turnoFinal?.horas_efectivas || 0;
  const horasAdicionales = overridesAdicional.reduce((sum, o) => {
    const t = o.turno || o;
    return sum + (t.horas_efectivas || 0);
  }, 0);

  return buildResultado({
    tipo_dia: resolucion.tipo_dia,
    turno_teorico: turnoFinal,
    overrides,
    origen: origenFinal,
    horas_efectivas_total: horasBase + horasAdicionales,
    ...cal,
    hlg_id: hlg.id,
    regimen_horario_id: hlg.regimen_horario_id,
    plan_id: resolucion.plan_id || null,
    posicion_ciclo: resolucion.posicion_ciclo ?? null,
  });
}

function buildResultado(data) {
  const esLaborable = data.tipo_dia === "laborable" || data.tipo_dia === "guardia";
  return {
    tipo_dia: data.tipo_dia || "no_laborable",
    turno_teorico: data.turno_teorico || null,
    overrides: data.overrides || [],
    horas_efectivas_total: data.horas_efectivas_total ?? (data.turno_teorico?.horas_efectivas || 0),
    es_feriado: data.es_feriado || false,
    evento_calendario_id: data.evento_calendario_id || null,
    tipo_evento_calendario: data.tipo_evento || null,
    multiplicador_feriado: data.multiplicador || 1,
    es_dia_laborable: esLaborable,
    origen: data.origen || "sin_regimen",
    regimen_horario_id: data.regimen_horario_id || null,
    hlg_id: data.hlg_id || null,
    plan_id: data.plan_id || null,
    posicion_ciclo: data.posicion_ciclo ?? null,
  };
}

function buildResultadoVacio(origen, _motivo) {
  return buildResultado({ tipo_dia: "no_laborable", turno_teorico: null, overrides: [], origen });
}

module.exports = {
  resolverTurnoDia,
  resolverFijo,
  resolverRotativo,
  cruzaMedianoche,
  buildTurnoResponse,
  isoWeekday,
  diffDays,
  ymdToDate,
};
