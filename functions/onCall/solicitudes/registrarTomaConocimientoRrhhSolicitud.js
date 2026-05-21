"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { registrarTomaConocimientoRrhhSolicitud } = require("../../modules/shared/solicitudBandejaRrhhCore");

const registrarTomaConocimientoRrhhSolicitudCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede registrar toma de conocimiento.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  const motivo = typeof d.motivo === "string" ? d.motivo.trim().slice(0, 500) : "";

  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);
  const result = await registrarTomaConocimientoRrhhSolicitud(db, solicitudId, revisorPersonaId, motivo);

  if (!result.ok) {
    const code =
      result.codigo === "TC_YA_REGISTRADA" ? "failed-precondition" : "failed-precondition";
    throw new HttpsError(code, result.mensaje || "No se pudo registrar la toma de conocimiento.");
  }

  return result;
});

module.exports = { registrarTomaConocimientoRrhhSolicitud: registrarTomaConocimientoRrhhSolicitudCallable };
