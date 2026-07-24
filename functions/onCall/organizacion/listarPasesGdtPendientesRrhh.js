"use strict";

/**
 * Callable: listarPasesGdtPendientesRrhh
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const {
  listarPasesGdtPendientesRrhhCore,
} = require("../../modules/organizacion/listarPasesGdtPendientesRrhhCore");

const listarPasesGdtPendientesRrhhCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede listar pases pendientes.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = await listarPasesGdtPendientesRrhhCore(db, {
    limite: typeof d.limite === "number" ? d.limite : undefined,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo listar la bandeja de pases.",
    );
  }

  return { ok: true, items: result.items, total: result.total };
});

module.exports = { listarPasesGdtPendientesRrhh: listarPasesGdtPendientesRrhhCallable };
