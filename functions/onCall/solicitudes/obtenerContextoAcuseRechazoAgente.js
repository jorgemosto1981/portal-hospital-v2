"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const {
  obtenerContextoAcuseRechazoAgente,
} = require("../../modules/shared/solicitudAcuseRechazoAgenteCore");

const obtenerContextoAcuseRechazoAgenteCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const titularPersonaId = assertAgenteConPersonaId(request);
  const result = await obtenerContextoAcuseRechazoAgente(db, solicitudId, titularPersonaId);

  if (!result.ok) {
    if (result.codigo === "FORBIDDEN") {
      throw new HttpsError("permission-denied", result.mensaje || "Sin permiso.");
    }
    if (result.codigo === "NOT_FOUND") {
      throw new HttpsError("not-found", result.mensaje || "No encontrada.");
    }
    throw new HttpsError("failed-precondition", result.mensaje || "No se pudo obtener el contexto.");
  }

  return result;
});

module.exports = {
  obtenerContextoAcuseRechazoAgente: obtenerContextoAcuseRechazoAgenteCallable,
};
