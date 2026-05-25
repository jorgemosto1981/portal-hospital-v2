"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { resolverDecisionRrhhSolicitud } = require("../../modules/shared/solicitudBandejaRrhhCore");

const resolverDecisionRrhhSolicitudCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede resolver solicitudes en esta bandeja.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  const decision = typeof d.decision === "string" ? d.decision.trim().toLowerCase() : "";
  const motivo = typeof d.motivo === "string" ? d.motivo.trim().slice(0, 500) : "";

  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }
  if (decision !== "aprobar" && decision !== "rechazar") {
    throw new HttpsError("invalid-argument", "decision debe ser aprobar o rechazar.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);

  const result = await resolverDecisionRrhhSolicitud(db, solicitudId, revisorPersonaId, decision, motivo);

  if (!result.ok) {
    const code = result.codigo === "PERMISSION_DENIED" ? "permission-denied" : "failed-precondition";
    throw new HttpsError(code, result.mensaje || "No se pudo resolver la decisión.");
  }

  return result;
});

module.exports = { resolverDecisionRrhhSolicitud: resolverDecisionRrhhSolicitudCallable };
