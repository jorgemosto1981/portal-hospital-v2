"use strict";

/**
 * Callable: rechazarPaseGdt
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.3
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { rechazarPaseGdtCore } = require("../../modules/organizacion/rechazarPaseGdtCore");

const rechazarPaseGdtCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede rechazar pases.");
  }
  const resolventePersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";
  if (!resolventePersonaId) {
    throw new HttpsError("permission-denied", "Sin persona vinculada en el token.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = await rechazarPaseGdtCore(db, {
    paseId: typeof d.pase_id === "string" ? d.pase_id.trim() : "",
    motivoRechazo: typeof d.motivo_rechazo === "string" ? d.motivo_rechazo : "",
    resolventePersonaId,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo rechazar el pase.",
    );
  }

  return { ok: true, pase_id: result.pase_id, estado: result.estado };
});

module.exports = { rechazarPaseGdt: rechazarPaseGdtCallable };
