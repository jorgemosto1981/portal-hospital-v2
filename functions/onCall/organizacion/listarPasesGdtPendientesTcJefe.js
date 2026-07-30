"use strict";

/**
 * Callable: listarPasesGdtPendientesTcJefe
 * Params: vista (pendiente|historico), orden, direccion, page, page_size
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const {
  listarPasesGdtPendientesTcJefeCore,
} = require("../../modules/organizacion/listarPasesGdtPendientesTcCore");

const listarPasesGdtPendientesTcJefeCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  const actorPersonaId = typeof token.persona_id === "string" ? token.persona_id.trim() : "";
  if (!actorPersonaId) {
    throw new HttpsError("permission-denied", "Sin persona vinculada en el token.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const result = await listarPasesGdtPendientesTcJefeCore(db, {
    actorPersonaId,
    vista: typeof d.vista === "string" ? d.vista : undefined,
    orden: typeof d.orden === "string" ? d.orden : undefined,
    direccion: typeof d.direccion === "string" ? d.direccion : undefined,
    page: typeof d.page === "number" ? d.page : undefined,
    pageSize: typeof d.page_size === "number" ? d.page_size : typeof d.pageSize === "number" ? d.pageSize : undefined,
    limite: typeof d.limite === "number" ? d.limite : undefined,
  });

  if (!result.ok) {
    throw new HttpsError(
      /** @type {import("firebase-functions/v2/https").FunctionsErrorCode} */ (result.code || "internal"),
      result.message || "No se pudo listar pases pendientes de TC.",
    );
  }

  return {
    ok: true,
    vista: result.vista,
    orden: result.orden,
    direccion: result.direccion,
    items: result.items,
    total: result.total,
    page: result.page,
    page_size: result.page_size,
    total_pages: result.total_pages,
    has_prev: result.has_prev,
    has_next: result.has_next,
    truncated: result.truncated === true,
    warning: result.warning || null,
  };
});

module.exports = { listarPasesGdtPendientesTcJefe: listarPasesGdtPendientesTcJefeCallable };
