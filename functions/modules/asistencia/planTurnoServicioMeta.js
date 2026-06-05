"use strict";

/**
 * Metadatos RFC plan paralelo — roles, estados y arrays denormalizados en plt_*.
 */

const PLAN_ROL_PRINCIPAL = "principal";
const PLAN_ROL_INCORPORACION = "incorporacion";

const PLAN_ROLES = new Set([PLAN_ROL_PRINCIPAL, PLAN_ROL_INCORPORACION]);

/** Estados de la máquina (incl. terminal post-merge incorporación). */
const ESTADOS_PLAN_TURNO_SERVICIO = [
  "BORRADOR",
  "ENVIADO",
  "HABILITADO",
  "EN_REVISION",
  "CERRADO",
  "MERGEADO",
];

const ESTADOS_PLAN_TERMINALES = new Set(["CERRADO", "MERGEADO"]);

/**
 * @param {object|null|undefined} plan
 * @returns {string}
 */
function planRolDeDoc(plan) {
  const r = String(plan?.plan_rol || "").trim();
  return PLAN_ROLES.has(r) ? r : PLAN_ROL_PRINCIPAL;
}

/**
 * @param {object[]|null|undefined} agentes
 * @returns {{ agentes_persona_ids: string[], agentes_hlg_ids: string[] }}
 */
function buildAgentesIndicesDenormalizados(agentes) {
  const personaIds = new Set();
  const hlgIds = new Set();
  for (const ag of agentes || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (/^per_/i.test(pid)) personaIds.add(pid);
    const hid = String(ag?.hlg_id || "").trim();
    if (/^hlg_/i.test(hid)) hlgIds.add(hid);
  }
  return {
    agentes_persona_ids: [...personaIds].sort(),
    agentes_hlg_ids: [...hlgIds].sort(),
  };
}

/**
 * Campos RFC a persistir en cada write de plan (merge con payload existente).
 * @param {object} params
 * @param {object[]|null|undefined} params.agentes
 * @param {string|null|undefined} params.plan_rol
 * @param {string|null|undefined} params.plan_padre_id
 */
function buildPlanMetaPayload({ agentes, plan_rol, plan_padre_id }) {
  const rol = plan_rol && PLAN_ROLES.has(plan_rol) ? plan_rol : PLAN_ROL_PRINCIPAL;
  const indices = buildAgentesIndicesDenormalizados(agentes);
  const out = {
    plan_rol: rol,
    ...indices,
  };
  if (rol === PLAN_ROL_INCORPORACION) {
    const padre = typeof plan_padre_id === "string" ? plan_padre_id.trim() : "";
    if (padre) out.plan_padre_id = padre;
  } else {
    out.plan_padre_id = null;
  }
  return out;
}

/**
 * @param {object} plan
 * @returns {boolean}
 */
function esPlanPrincipalOperativo(plan) {
  if (!plan || plan.eliminado === true) return false;
  if (plan.estado === "MERGEADO") return false;
  return planRolDeDoc(plan) === PLAN_ROL_PRINCIPAL;
}

module.exports = {
  PLAN_ROL_PRINCIPAL,
  PLAN_ROL_INCORPORACION,
  PLAN_ROLES,
  ESTADOS_PLAN_TURNO_SERVICIO,
  ESTADOS_PLAN_TERMINALES,
  planRolDeDoc,
  buildAgentesIndicesDenormalizados,
  buildPlanMetaPayload,
  esPlanPrincipalOperativo,
};
