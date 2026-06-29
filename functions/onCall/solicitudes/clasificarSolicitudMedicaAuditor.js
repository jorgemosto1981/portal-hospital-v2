"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { clasificarSolicitudMedicaAuditor } = require("../../modules/shared/clasificarSolicitudMedicaAuditorCore");

function tokenHasAuditorMedicoAccess(token) {
  if (tokenHasRrhhLaborAccess(token)) return true;
  const raw = token && typeof token === "object" ? token.roles_hlc_vigentes : null;
  if (!Array.isArray(raw)) return false;
  return raw.some((r) => {
    const id = String(r || "").trim().toUpperCase();
    return id === "AUDITOR_MEDICO" || id === "CFG_AUDITOR_MEDICO" || id.includes("AUDITOR_MEDICO");
  });
}

function assertAuditorMedico(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (tokenHasAuditorMedicoAccess(request.auth.token)) {
    return assertAgenteConPersonaId(request);
  }
  throw new HttpsError("permission-denied", "Solo médico auditor autorizado.");
}

const clasificarSolicitudMedicaAuditorCallable = onCall(async (request) => {
  const auditorPersonaId = assertAuditorMedico(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};

  const result = await clasificarSolicitudMedicaAuditor(db, {
    solicitudId: typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "",
    auditorPersonaId,
    articuloId: typeof d.articulo_id === "string" ? d.articulo_id.trim() : "",
    versionIdAplicada:
      typeof d.version_id_aplicada === "string"
        ? d.version_id_aplicada.trim()
        : typeof d.version_aplicada_id === "string"
          ? d.version_aplicada_id.trim()
          : "",
    fechaDesde: typeof d.fecha_desde === "string" ? d.fecha_desde.trim() : "",
    fechaHasta: typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim() : "",
    grupoTrabajoIdAncla:
      typeof d.grupo_trabajo_id_ancla === "string" ? d.grupo_trabajo_id_ancla.trim() : undefined,
    observacionAuditor:
      typeof d.observacion_auditor === "string" ? d.observacion_auditor.trim() : undefined,
    dictamenFavorable: d.dictamen_favorable === true,
  });

  if (!result.ok) {
    const code =
      result.codigo === "ESTADO_INVALIDO" || result.codigo === "AVISO_INCOMPLETO"
        ? "failed-precondition"
        : "invalid-argument";
    throw new HttpsError(code, result.mensaje || "No se pudo clasificar la solicitud.");
  }

  return result;
});

module.exports = { clasificarSolicitudMedicaAuditor: clasificarSolicitudMedicaAuditorCallable };
