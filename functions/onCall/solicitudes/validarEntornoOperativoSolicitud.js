"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { resolvePersonaIdSolicitudFlujoAgente } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewMotor");
const { isPortalRoleUsuario } = require("../../modules/shared/solicitudElegibilidadLaboral");
const { validarEntornoOperativoSolicitud } = require("../../modules/ticketera/validarEntornoOperativoCore");

const validarEntornoOperativoSolicitudCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!isPortalRoleUsuario(token)) {
    throw new HttpsError(
      "permission-denied",
      "No tenés un cargo laboral vigente completo (HLc→HLd→HLg) para operar solicitudes. Pedí a RRHH la carga o sincronizá sesión tras actualizar datos laborales.",
    );
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = resolvePersonaIdSolicitudFlujoAgente(request, d);
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const versionId =
    typeof d.version_id === "string"
      ? d.version_id.trim()
      : typeof d.version_aplicada_id === "string"
        ? d.version_aplicada_id.trim()
        : "";
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  const diasRaw = Number(d.dias_solicitados);
  const grupoTrabajoIdAncla =
    typeof d.grupo_trabajo_id_ancla === "string"
      ? d.grupo_trabajo_id_ancla.trim()
      : typeof d.grupo_de_trabajo_id === "string"
        ? d.grupo_de_trabajo_id.trim()
        : "";

  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }

  return validarEntornoOperativoSolicitud({
    db,
    personaId,
    articuloId,
    versionId,
    fechaDesde,
    diasSolicitados: Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : undefined,
    grupoTrabajoIdAncla: grupoTrabajoIdAncla || null,
    authToken: request.auth.token,
  });
});

module.exports = { validarEntornoOperativoSolicitud: validarEntornoOperativoSolicitudCallable };
