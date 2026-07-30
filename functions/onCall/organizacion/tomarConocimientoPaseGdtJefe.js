"use strict";

/**
 * Callable: tomarConocimientoPaseGdtJefe
 * @see docs/v2/SPIKE_PASES_GDT_FASE2_V2.md §4.4
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const {
  tomarConocimientoPaseGdtJefeCore,
} = require("../../modules/organizacion/tomarConocimientoPaseGdtCore");

const tomarConocimientoPaseGdtJefeCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  const actorPersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";
  if (!actorPersonaId) {
    throw new HttpsError("permission-denied", "Sin persona vinculada en el token.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = await tomarConocimientoPaseGdtJefeCore(db, {
    paseId: typeof d.pase_id === "string" ? d.pase_id.trim() : "",
    actorPersonaId,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo registrar la toma de conocimiento.",
    );
  }

  return {
    ok: true,
    pase_id: result.pase_id,
    estado: result.estado,
    actor: result.actor,
    jefes_pendientes_restantes: result.jefes_pendientes_restantes,
  };
});

module.exports = { tomarConocimientoPaseGdtJefe: tomarConocimientoPaseGdtJefeCallable };
