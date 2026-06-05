"use strict";

/**
 * RFC plan paralelo — merge puro y filtros de materialización (testeable sin Firestore).
 */

const { PLAN_ROL_INCORPORACION, PLAN_ROL_PRINCIPAL, buildPlanMetaPayload, planRolDeDoc } = require("./planTurnoServicioMeta");

const ESTADOS_INCORPORACION_FLUJO_ACTIVO = new Set(["BORRADOR", "ENVIADO", "EN_REVISION"]);

/**
 * @param {object[]} agentesHlg — { personaId, hlgId, regimenId }
 * @param {string[]|null|undefined} personaIdsFilter
 */
function filtrarAgentesMaterializacionPorPersona(agentesHlg, personaIdsFilter) {
  const list = Array.isArray(agentesHlg) ? agentesHlg : [];
  if (!personaIdsFilter || personaIdsFilter.length === 0) return list;
  const allow = new Set(personaIdsFilter.map((id) => String(id || "").trim()).filter(Boolean));
  return list.filter((a) => allow.has(String(a.personaId || "").trim()));
}

/**
 * @param {object[]} agentesPadre
 * @param {object[]} agentesHijo
 * @returns {{ ok: boolean, code?: string, persona_id?: string, agentes?: object[] }}
 */
function mergeAgentesEditorAlPadre(agentesPadre, agentesHijo) {
  const porPid = new Map();
  for (const ag of agentesPadre || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (pid) porPid.set(pid, ag);
  }
  for (const ag of agentesHijo || []) {
    const pid = String(ag?.persona_id || "").trim();
    if (!pid) continue;
    if (porPid.has(pid)) {
      return { ok: false, code: "PLT-MRG-001", persona_id: pid };
    }
    porPid.set(pid, ag);
  }
  return { ok: true, agentes: [...porPid.values()] };
}

/**
 * @param {object|null|undefined} grillaPadre
 * @param {object[]} agentesGrillaNuevos — bloque construirGrillaAprobada (solo hijo)
 */
function appendGrillaAprobadaParcial(grillaPadre, agentesGrillaNuevos) {
  const base = grillaPadre && typeof grillaPadre === "object" ? { ...grillaPadre } : null;
  const existentes = new Set(
    (base?.agentes || []).map((a) => String(a?.persona_id || "").trim()).filter(Boolean),
  );
  const nuevos = (agentesGrillaNuevos || []).filter((a) => {
    const pid = String(a?.persona_id || "").trim();
    return pid && !existentes.has(pid);
  });
  if (!base) {
    return {
      version: 1,
      agentes: nuevos,
    };
  }
  return {
    ...base,
    agentes: [...(base.agentes || []), ...nuevos],
  };
}

/**
 * @param {object} params
 */
function buildRegistroIncorporacionMergeada({ planHijoId, actorPersonaId }) {
  return {
    plan_id: planHijoId,
    mergeado_en: new Date().toISOString(),
    mergeado_por_persona_id: actorPersonaId || null,
  };
}

/**
 * @param {object} planDoc
 */
function esPlanIncorporacionActivo(planDoc) {
  if (!planDoc || planDoc.eliminado === true) return false;
  if (planRolDeDoc(planDoc) !== PLAN_ROL_INCORPORACION) return false;
  return ESTADOS_INCORPORACION_FLUJO_ACTIVO.has(planDoc.estado);
}

/**
 * Stubs de agentes[] para plt_inc recién creado.
 * @param {object[]} agentesNuevos — salida detectarAgentesNuevosPlanificados
 */
function agentesStubIncorporacion(agentesNuevos) {
  return (agentesNuevos || []).map((a) => ({
    persona_id: a.persona_id,
    regimen_horario_id: a.regimen_horario_id,
    hlg_id: a.hlg_id,
    regimen_fecha_ancla: null,
    dias: {},
  }));
}

function assertPadreHabilitadoParaMerge(padreDoc, padreId) {
  if (!padreDoc) {
    return { ok: false, code: "PLT-MRG-010", message: `[PLT-MRG-010] Plan padre ${padreId} no encontrado.` };
  }
  if (padreDoc.eliminado === true) {
    return { ok: false, code: "PLT-MRG-011", message: "[PLT-MRG-011] El plan padre fue eliminado." };
  }
  if (planRolDeDoc(padreDoc) !== PLAN_ROL_PRINCIPAL) {
    return { ok: false, code: "PLT-MRG-012", message: "[PLT-MRG-012] El plan padre no es principal." };
  }
  if (padreDoc.estado !== "HABILITADO") {
    return {
      ok: false,
      code: "PLT-MRG-013",
      message: `[PLT-MRG-013] El plan padre debe seguir HABILITADO (estado actual: ${padreDoc.estado || "?"}).`,
    };
  }
  return { ok: true };
}

module.exports = {
  ESTADOS_INCORPORACION_FLUJO_ACTIVO,
  PLAN_ROL_INCORPORACION,
  PLAN_ROL_PRINCIPAL,
  filtrarAgentesMaterializacionPorPersona,
  mergeAgentesEditorAlPadre,
  appendGrillaAprobadaParcial,
  buildRegistroIncorporacionMergeada,
  esPlanIncorporacionActivo,
  agentesStubIncorporacion,
  assertPadreHabilitadoParaMerge,
  buildPlanMetaPayload,
};
