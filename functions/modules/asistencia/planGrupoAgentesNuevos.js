"use strict";

/**
 * §19.6 — Agentes con HLg planificado vigente en el mes que no figuran en el plan mensual del grupo.
 */

const ORDEN_PLAN_CANONICO = ["HABILITADO", "ENVIADO", "EN_REVISION", "BORRADOR", "CERRADO"];

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

/**
 * @param {object[]} planesActivos — docs sin eliminado
 * @returns {object|null}
 */
function elegirPlanMensualCanonico(planesActivos) {
  const list = Array.isArray(planesActivos) ? planesActivos : [];
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
 */
function detectarAgentesNuevosPlanificados({ personasGrupo, regimenes, personaIdsEnPlanMensual }) {
  const enPlan = personaIdsEnPlanMensual instanceof Set ? personaIdsEnPlanMensual : new Set();
  const nuevos = [];
  for (const pg of personasGrupo || []) {
    const pid = String(pg.persona_id || "").trim();
    if (!pid || enPlan.has(pid)) continue;
    const reg = regimenes?.[pg.regimen_horario_id];
    if (!regimenEsPlanificado(reg)) continue;
    nuevos.push({
      persona_id: pid,
      persona_label: pg.persona_label || pid,
      persona_dni: pg.persona_dni || null,
      regimen_horario_id: pg.regimen_horario_id || null,
      hlg_id: pg.hlg_id || null,
    });
  }
  nuevos.sort((a, b) =>
    String(a.persona_label || a.persona_id).localeCompare(String(b.persona_label || b.persona_id), "es"),
  );
  return nuevos;
}

/**
 * Fusiona solo agentes nuevos; las filas ya en el plan no se modifican.
 * @param {object[]} agentesExistentes
 * @param {object[]} agentesPayload
 * @param {Set<string>} idsNuevosPermitidos
 */
function mergeAgentesIncorporacionPlanMensual(agentesExistentes, agentesPayload, idsNuevosPermitidos) {
  const permitidos = idsNuevosPermitidos instanceof Set ? idsNuevosPermitidos : new Set(idsNuevosPermitidos);
  const porPid = new Map();
  for (const ag of agentesExistentes || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (pid) porPid.set(pid, ag);
  }
  for (const ag of agentesPayload || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (!pid) continue;
    if (porPid.has(pid) && !permitidos.has(pid)) {
      continue;
    }
    if (!permitidos.has(pid)) {
      return { ok: false, code: "PLT-INC-001", persona_id: pid };
    }
    porPid.set(pid, ag);
  }
  return { ok: true, agentes: [...porPid.values()] };
}

/**
 * Plan HABILITADO no eliminado para grupo+período (evita `limit(1)` sobre doc borrado lógico).
 * @param {import("firebase-admin/firestore").QuerySnapshot} snap
 * @returns {{ planId: string, plan: object }|null}
 */
function planHabilitadoDesdeQuerySnapshot(snap) {
  if (!snap || snap.empty) return null;
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.eliminado !== true && p.estado === "HABILITADO");
  if (!list.length) return null;
  const pick = elegirPlanMensualCanonico(list);
  if (!pick) return null;
  const { id, ...plan } = pick;
  return { planId: id, plan };
}

module.exports = {
  ORDEN_PLAN_CANONICO,
  regimenEsPlanificado,
  personaIdsEnPlan,
  elegirPlanMensualCanonico,
  detectarAgentesNuevosPlanificados,
  mergeAgentesIncorporacionPlanMensual,
  planHabilitadoDesdeQuerySnapshot,
};
