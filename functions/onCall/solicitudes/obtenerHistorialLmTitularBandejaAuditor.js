"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const {
  obtenerHistorialLmTitularBandejaAuditor,
} = require("../../modules/shared/historialLmTitularBandejaAuditorCore");

const obtenerHistorialLmTitularBandejaAuditorCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};

  const result = await obtenerHistorialLmTitularBandejaAuditor(db, {
    titular_persona_id:
      typeof d.titular_persona_id === "string" ? d.titular_persona_id.trim() : "",
    excluir_solicitud_id:
      typeof d.excluir_solicitud_id === "string"
        ? d.excluir_solicitud_id.trim()
        : typeof d.solicitud_id === "string"
          ? d.solicitud_id.trim()
          : "",
    ampliado: d.ampliado === true,
  });

  if (!result.ok) {
    throw new HttpsError("invalid-argument", result.mensaje || "No se pudo obtener el historial.");
  }

  return {
    items: result.items,
    has_more: result.has_more === true,
    limite_visible: result.limite_visible,
  };
});

module.exports = {
  obtenerHistorialLmTitularBandejaAuditor: obtenerHistorialLmTitularBandejaAuditorCallable,
};
