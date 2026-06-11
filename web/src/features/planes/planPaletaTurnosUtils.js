import { esRegimenPlanificado } from "../../pages/jefe/planes/planGrillaRegimenUtils.js";

/** @param {string} turnoIdRaw */
export function parseTurnoCompuestoIds(turnoIdRaw) {
  const raw = String(turnoIdRaw || "").trim();
  if (!raw) return [];
  return raw.split("+").map((s) => s.trim()).filter(Boolean);
}

export function valorHorarioTurno(turno = {}) {
  const ingreso =
    String(turno.ingreso || turno.hora_ingreso || turno.h_ingreso || turno.desde || "").trim() || null;
  const egreso =
    String(turno.egreso || turno.hora_egreso || turno.h_egreso || turno.hasta || "").trim() || null;
  if (ingreso && egreso) return `${ingreso}-${egreso}`;
  if (ingreso) return ingreso;
  if (egreso) return egreso;
  return "";
}

/**
 * @param {object} regimen
 * @param {string} turnoId
 */
export function buscarTurnoEnRegimenPlan(regimen, turnoId) {
  const tid = String(turnoId || "").trim();
  if (!tid) return null;
  const list = regimen?.turnos_disponibles || [];
  return (
    list.find((t) => String(t?.turno_id || t?.id || "").trim() === tid) || null
  );
}

/**
 * Horario para celda planificada: descompone ids `M+T` en tramos del régimen.
 * @param {object} regimen
 * @param {string} turnoId
 */
export function horarioPlanificadoPorTurnoRegimen(regimen, turnoId) {
  const tid = String(turnoId || "").trim();
  if (!regimen || !tid) return "";

  if (!tid.includes("+")) {
    const turno = buscarTurnoEnRegimenPlan(regimen, tid);
    return turno ? valorHorarioTurno(turno) : "";
  }

  const partes = parseTurnoCompuestoIds(tid);
  const horarios = [];
  for (const part of partes) {
    const turno = buscarTurnoEnRegimenPlan(regimen, part);
    const h = turno ? valorHorarioTurno(turno) : "";
    if (h) horarios.push(h);
  }
  if (horarios.length) return horarios.join(" · ");

  const compuesto = buscarTurnoEnRegimenPlan(regimen, tid);
  return compuesto ? valorHorarioTurno(compuesto) : "";
}

/** @param {object} turno */
export function labelPaletaTurno(turno) {
  const tid = String(turno?.turno_id || turno?.id || "").trim();
  const etiqueta = String(turno?.etiqueta || "").trim();
  if (etiqueta) return etiqueta;
  if (tid.includes("+")) {
    return parseTurnoCompuestoIds(tid).join("+");
  }
  return tid;
}

/**
 * Mapa `turno_id` → metadatos para un régimen planificado.
 * @param {object} regimen
 */
export function buildPaletaTurnosRegimenPlanificado(regimen) {
  /** @type {Record<string, { label: string; horario: string }>} */
  const map = {};
  if (!regimen) return map;
  for (const t of regimen.turnos_disponibles || []) {
    const tid = String(t?.turno_id || t?.id || "").trim();
    if (!tid) continue;
    map[tid] = {
      label: labelPaletaTurno(t),
      horario: valorHorarioTurno(t) || horarioPlanificadoPorTurnoRegimen(regimen, tid),
    };
  }
  return map;
}

/**
 * @param {Record<string, object>} regimenes
 * @param {string[]} regimenIdsPlanificados
 */
function ordenarTurnoIds(ids) {
  return [...ids].sort((a, b) => {
    const aPlus = a.includes("+") ? 1 : 0;
    const bPlus = b.includes("+") ? 1 : 0;
    if (aPlus !== bPlus) return aPlus - bPlus;
    return a.localeCompare(b, "es");
  });
}

/**
 * Paleta del editor: unión de turnos por regímenes planificados en uso + mapa de permiso por fila.
 *
 * @param {Record<string, object>} regimenes
 * @param {Array<{ regimen_horario_id?: string }>} agentes
 * @param {Array<{ bg: string; text: string }>} coloresBase
 */
export function buildPaletaEditorPlanMensual(regimenes, agentes, coloresBase) {
  const regimenIds = new Set();
  for (const ag of agentes || []) {
    const rid = String(ag?.regimen_horario_id || "").trim();
    if (!rid) continue;
    if (esRegimenPlanificado(regimenes?.[rid])) regimenIds.add(rid);
  }

  const unionIds = new Set();
  /** @type {Record<string, Record<string, true>>} */
  const permitidosPorRegimen = {};

  for (const rid of regimenIds) {
    const reg = regimenes[rid];
    permitidosPorRegimen[rid] = {};
    for (const t of reg?.turnos_disponibles || []) {
      const tid = String(t?.turno_id || t?.id || "").trim();
      if (!tid) continue;
      unionIds.add(tid);
      permitidosPorRegimen[rid][tid] = true;
    }
  }

  const metaPorId = {};
  for (const rid of regimenIds) {
    const meta = buildPaletaTurnosRegimenPlanificado(regimenes[rid]);
    for (const [tid, row] of Object.entries(meta)) {
      if (!metaPorId[tid]) metaPorId[tid] = row;
    }
  }

  /** @type {Record<string, { bg: string; text: string; label: string }>} */
  const turnosPaleta = {};
  let idx = 0;
  for (const tid of ordenarTurnoIds([...unionIds])) {
    const color = coloresBase[idx % coloresBase.length];
    const meta = metaPorId[tid] || { label: tid, horario: "" };
    turnosPaleta[tid] = {
      ...color,
      label: meta.label || tid,
      horario: meta.horario,
    };
    idx += 1;
  }

  return { turnosPaleta, permitidosPorRegimen };
}

/**
 * @param {Record<string, Record<string, true>>} permitidosPorRegimen
 * @param {string} regimenHorarioId
 * @param {string} turnoId
 */
export function turnoPermitidoEnRegimenPlan(permitidosPorRegimen, regimenHorarioId, turnoId) {
  const tid = String(turnoId || "").trim();
  if (!tid) return false;
  const rid = String(regimenHorarioId || "").trim();
  return Boolean(permitidosPorRegimen?.[rid]?.[tid]);
}
