"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { resolverDecisionJefeSolicitud } = require("../../modules/shared/solicitudBandejaJefeCore");

const resolverDecisionJefeSolicitudCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token) && !tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Sesión sin perfil laboral para bandeja jefe.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  const decisionRaw = typeof d.decision === "string" ? d.decision.trim().toLowerCase() : "";
  const motivo = typeof d.motivo === "string" ? d.motivo.trim().slice(0, 500) : "";
  const modalidadGoce =
    typeof d.modalidad_goce_jefe === "string" ? d.modalidad_goce_jefe.trim().toLowerCase() : "";

  /** Aliases UI toma_conocimiento → motor autorización AS-IS (mismos estados). */
  const decision =
    decisionRaw === "conforme"
      ? "aprobar"
      : decisionRaw === "observado"
        ? "rechazar"
        : decisionRaw;

  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }
  if (decision !== "aprobar" && decision !== "rechazar") {
    throw new HttpsError(
      "invalid-argument",
      "decision debe ser aprobar|rechazar|conforme|observado.",
    );
  }
  if (
    modalidadGoce &&
    modalidadGoce !== "con_goce" &&
    modalidadGoce !== "sin_goce"
  ) {
    throw new HttpsError("invalid-argument", "modalidad_goce_jefe inválida.");
  }

  const revisorPersonaId = assertAgenteConPersonaId(request);
  const rrhhBypass = tokenHasRrhhLaborAccess(token);

  const result = await resolverDecisionJefeSolicitud(
    db,
    solicitudId,
    revisorPersonaId,
    decision,
    motivo,
    rrhhBypass,
    {
      modalidad_goce_jefe: modalidadGoce || null,
      decision_ui: decisionRaw || decision,
    },
  );

  if (!result.ok) {
    const codigo = result.codigo || "";
    const code =
      codigo === "PERMISSION_DENIED" || codigo === "PERMISOS_JERARQUICOS_CAMBIADOS"
        ? "permission-denied"
        : "failed-precondition";
    throw new HttpsError(code, result.mensaje || "No se pudo resolver la decisión.");
  }

  return result;
});

module.exports = { resolverDecisionJefeSolicitud: resolverDecisionJefeSolicitudCallable };
