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
  const confirmaInjustificada = d.confirma_injustificada === true;
  const confirmaSinGoce = d.confirma_sin_goce === true;

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
  if (decisionRaw === "observado" && motivo.length < 3) {
    throw new HttpsError(
      "invalid-argument",
      "Para marcar Observado el motivo es obligatorio (mín. 3 caracteres).",
    );
  }
  if (
    modalidadGoce &&
    modalidadGoce !== "con_goce" &&
    modalidadGoce !== "sin_goce"
  ) {
    throw new HttpsError("invalid-argument", "modalidad_goce_jefe inválida.");
  }
  if (decision === "aprobar" && modalidadGoce === "sin_goce") {
    if (motivo.length < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Para autorizar sin goce (64-B) el justificativo es obligatorio (mín. 3 caracteres).",
      );
    }
    if (!confirmaSinGoce) {
      throw new HttpsError(
        "invalid-argument",
        "Para autorizar sin goce (64-B) debés confirmar la modalidad.",
      );
    }
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
      confirma_injustificada: confirmaInjustificada,
      confirma_sin_goce: confirmaSinGoce,
    },
  );

  if (!result.ok) {
    const codigo = result.codigo || "";
    const code =
      codigo === "PERMISSION_DENIED" || codigo === "PERMISOS_JERARQUICOS_CAMBIADOS"
        ? "permission-denied"
        : codigo === "MOTIVO_OBSERVADO_REQUERIDO" ||
            codigo === "CONFIRMA_INJUSTIFICADA_REQUERIDA" ||
            codigo === "MOTIVO_SIN_GOCE_REQUERIDO" ||
            codigo === "CONFIRMA_SIN_GOCE_REQUERIDA" ||
            codigo === "SALDO_64B" ||
            codigo === "SALDO_64B_INSUFICIENTE" ||
            codigo === "VERSION_64B_NO_ENCONTRADA" ||
            codigo === "MODALIDAD_FIJA_SIN_GOCE" ||
            codigo === "SALDO_MES"
          ? "invalid-argument"
          : "failed-precondition";
    throw new HttpsError(code, result.mensaje || "No se pudo resolver la decisión.");
  }

  return result;
});

module.exports = { resolverDecisionJefeSolicitud: resolverDecisionJefeSolicitudCallable };
