"use strict";

/**
 * Aprobación jerárquica de planes de turno (misma cadena que solicitudes).
 * Plan huérfano → solo RRHH. Si hay superior → bandeja del autorizador, no del creador.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { resolverCadenaAutorizacion } = require("../shared/solicitudAutorizacionJerarquicaCore");
const { tokenHasRrhhAccess } = require("../shared/helpers");

function actorPersonaId(request) {
  const t = request.auth && request.auth.token;
  return t && typeof t.persona_id === "string" ? t.persona_id.trim() : "";
}

/**
 * @param {object} plan
 * @returns {string}
 */
function fechaRefDesdePlan(plan) {
  if (plan.periodo && /^\d{4}-\d{2}$/.test(plan.periodo)) {
    return `${plan.periodo}-01`;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {object} plan
 */
async function resolverAprobacionPendientePlan(db, plan) {
  const grupoId = String(plan.grupo_id || "").trim();
  const creadorId = String(plan.creado_por_persona_id || "").trim();
  if (!grupoId || !creadorId) {
    return {
      huerfano: true,
      autorizadores_elegibles_ids: [],
      grupo_autorizacion_id: null,
      escalamiento_jerarquico_ids: [],
    };
  }

  const cadena = await resolverCadenaAutorizacion(db, {
    titularPersonaId: creadorId,
    grupoTrabajoIdAncla: grupoId,
    fechaRefYmd: fechaRefDesdePlan(plan),
  });

  if (!cadena.ok) {
    return {
      huerfano: true,
      autorizadores_elegibles_ids: [],
      grupo_autorizacion_id: null,
      escalamiento_jerarquico_ids: [],
      error_codigo: cadena.codigo || null,
    };
  }

  return {
    huerfano: cadena.autorizacion_rrhh_sustituta === true,
    autorizadores_elegibles_ids: cadena.autorizadores_elegibles_ids || [],
    grupo_autorizacion_id: cadena.grupo_autorizacion_id || null,
    escalamiento_jerarquico_ids: cadena.escalamiento_jerarquico_ids || [],
  };
}

/**
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @param {object} plan
 * @param {object} aprobacionPendiente
 */
function assertPlanAprobarORechazar(request, plan, aprobacionPendiente) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasRrhhAccess(request.auth.token)) return;

  const actorPid = actorPersonaId(request);
  if (!actorPid) {
    throw new HttpsError("permission-denied", "Sin persona vinculada.");
  }

  const creadorId = String(plan.creado_por_persona_id || "").trim();
  if (creadorId && creadorId === actorPid) {
    throw new HttpsError(
      "permission-denied",
      "No podés aprobar ni rechazar un plan que enviaste vos. Si el servicio no tiene superior, RRHH lo revisará.",
    );
  }

  if (aprobacionPendiente.huerfano) {
    throw new HttpsError(
      "permission-denied",
      "Plan huérfano: no hay superior jerárquico. Solo RRHH puede aprobar o rechazar.",
    );
  }

  const ids = aprobacionPendiente.autorizadores_elegibles_ids || [];
  if (!ids.includes(actorPid)) {
    throw new HttpsError(
      "permission-denied",
      "No sos el autorizador jerárquico de este plan.",
    );
  }
}

/**
 * @param {object} plan
 * @param {string} actorPersonaId
 * @param {object} aprobacionPendiente
 */
function planVisibleEnBandejaJefe(plan, actorPersonaId, aprobacionPendiente) {
  const estado = plan.estado;
  if (estado !== "ENVIADO" && estado !== "EN_REVISION") return false;
  if (!actorPersonaId) return false;
  if (aprobacionPendiente.huerfano) return false;

  const creadorId = String(plan.creado_por_persona_id || "").trim();
  if (creadorId && creadorId === actorPersonaId) return false;

  return (aprobacionPendiente.autorizadores_elegibles_ids || []).includes(actorPersonaId);
}

module.exports = {
  fechaRefDesdePlan,
  resolverAprobacionPendientePlan,
  assertPlanAprobarORechazar,
  planVisibleEnBandejaJefe,
};
