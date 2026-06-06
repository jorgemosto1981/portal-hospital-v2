"use strict";

/**
 * §19.6 — Agentes con HLg planificado vigente en el mes que no figuran en el plan mensual del grupo.
 */

const { PLAN_ROL_PRINCIPAL, planRolDeDoc } = require("./planTurnoServicioMeta");

const ORDEN_PLAN_CANONICO = ["HABILITADO", "ENVIADO", "EN_REVISION", "BORRADOR", "CERRADO"];

function filtrarPlanesPrincipalesOperativos(planes) {
  return (planes || []).filter((p) => {
    if (p.eliminado === true) return false;
    if (p.estado === "MERGEADO") return false;
    return planRolDeDoc(p) === PLAN_ROL_PRINCIPAL;
  });
}

function regimenEsPlanificado(regimenDoc) {
  return Boolean(regimenDoc && regimenDoc.tipo_patron === "planificado");
}

/** @param {object|null|undefined} plan */
function personaIdsEnPlan(plan) {
  const set = new Set();
  for (const ag of plan?.agentes || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (/^per_/i.test(pid)) set.add(pid);
  }
  return set;
}

/** @param {object|null|undefined} plan */
function hlgIdsEnPlan(plan) {
  const set = new Set();
  for (const ag of plan?.agentes || []) {
    const hid = String(ag?.hlg_id || "").trim();
    if (/^hlg_/i.test(hid)) set.add(hid);
  }
  return set;
}

/**
 * @param {object[]} planesActivos — docs sin eliminado
 * @returns {object|null}
 */
function elegirPlanMensualCanonico(planesActivos) {
  const list = filtrarPlanesPrincipalesOperativos(planesActivos);
  for (const estado of ORDEN_PLAN_CANONICO) {
    const found = list.find((p) => p.estado === estado);
    if (found) return found;
  }
  return list[0] || null;
}

/**
 * @param {object} params
 * @param {object[]} params.personasGrupo
 * @param {Record<string, object>} params.regimenes
 * @param {Set<string>} params.personaIdsEnPlanMensual
 * @param {Set<string>} [params.hlgIdsEnPlanMensual]
 */
function detectarAgentesNuevosPlanificados({
  personasGrupo,
  regimenes,
  personaIdsEnPlanMensual,
  hlgIdsEnPlanMensual,
}) {
  const enPlanPersona = personaIdsEnPlanMensual instanceof Set ? personaIdsEnPlanMensual : new Set();
  const enPlanHlg = hlgIdsEnPlanMensual instanceof Set ? hlgIdsEnPlanMensual : new Set();
  const nuevos = [];
  for (const pg of personasGrupo || []) {
    const pid = String(pg.persona_id || "").trim();
    const hid = String(pg.hlg_id || "").trim();
    if (!pid) continue;
    if (hid && enPlanHlg.has(hid)) continue;
    if (!hid && enPlanPersona.has(pid)) continue;
    const reg = regimenes?.[pg.regimen_horario_id];
    if (!regimenEsPlanificado(reg)) continue;
    nuevos.push({
      persona_id: pid,
      persona_label: pg.persona_label || pid,
      persona_dni: pg.persona_dni || null,
      regimen_horario_id: pg.regimen_horario_id || null,
      hlg_id: pg.hlg_id || null,
      fila_id: pg.fila_id || null,
    });
  }
  nuevos.sort((a, b) =>
    String(a.persona_label || a.persona_id).localeCompare(String(b.persona_label || b.persona_id), "es"),
  );
  return nuevos;
}

function agentePlanKey(ag) {
  const hid = String(ag?.hlg_id || "").trim();
  if (/^hlg_/i.test(hid)) return `hlg:${hid}`;
  const pid = String(ag?.persona_id || "").trim();
  return `per:${pid}`;
}

/**
 * Fusiona solo agentes nuevos; las filas ya en el plan no se modifican.
 * @param {object[]} agentesExistentes
 * @param {object[]} agentesPayload
 * @param {Set<string>} idsNuevosPermitidos — persona_id permitidos (incorporación)
 */
function mergeAgentesIncorporacionPlanMensual(agentesExistentes, agentesPayload, idsNuevosPermitidos) {
  const permitidos = idsNuevosPermitidos instanceof Set ? idsNuevosPermitidos : new Set(idsNuevosPermitidos);
  const porKey = new Map();
  for (const ag of agentesExistentes || []) {
    const key = agentePlanKey(ag);
    if (!key || key === "per:" || key === "hlg:") continue;
    porKey.set(key, ag);
  }
  for (const ag of agentesPayload || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (!pid) continue;
    const key = agentePlanKey(ag);
    if (porKey.has(key) && !permitidos.has(pid)) {
      continue;
    }
    if (!permitidos.has(pid)) {
      return { ok: false, code: "PLT-INC-001", persona_id: pid };
    }
    porKey.set(key, ag);
  }
  return { ok: true, agentes: [...porKey.values()] };
}

/**
 * Plan HABILITADO no eliminado para grupo+período (evita `limit(1)` sobre doc borrado lógico).
 * @param {import("firebase-admin/firestore").QuerySnapshot} snap
 * @returns {{ planId: string, plan: object }|null}
 */
function planHabilitadoDesdeQuerySnapshot(snap) {
  if (!snap || snap.empty) return null;
  const list = filtrarPlanesPrincipalesOperativos(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  ).filter((p) => p.estado === "HABILITADO");
  if (!list.length) return null;
  const pick = elegirPlanMensualCanonico(list);
  if (!pick) return null;
  const { id, ...plan } = pick;
  return { planId: id, plan };
}

module.exports = {
  ORDEN_PLAN_CANONICO,
  filtrarPlanesPrincipalesOperativos,
  regimenEsPlanificado,
  personaIdsEnPlan,
  hlgIdsEnPlan,
  elegirPlanMensualCanonico,
  detectarAgentesNuevosPlanificados,
  mergeAgentesIncorporacionPlanMensual,
  planHabilitadoDesdeQuerySnapshot,
};
