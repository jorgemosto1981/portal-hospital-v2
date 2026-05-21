"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { obtenerResumenSolicitudArticuloGrilla } = require("../../modules/shared/solicitudResumenGrillaCore");

const obtenerResumenSolicitudArticuloGrillaCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil para consultar solicitudes.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);
  const result = await obtenerResumenSolicitudArticuloGrilla(db, solicitudId, revisorPersonaId, {
    rrhhBypass: tokenHasRrhhLaborAccess(token),
  });

  if (!result.ok) {
    const code = result.codigo === "NOT_FOUND" ? "not-found" : "permission-denied";
    throw new HttpsError(code, result.mensaje || "No se pudo obtener el resumen.");
  }

  return result;
});

module.exports = { obtenerResumenSolicitudArticuloGrilla: obtenerResumenSolicitudArticuloGrillaCallable };
