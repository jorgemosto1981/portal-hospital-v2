"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const {
  previsualizarClasificacionMedicaAuditor,
} = require("../../modules/shared/previsualizarClasificacionMedicaAuditorCore");

const previsualizarClasificacionMedicaAuditorCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};

  const result = await previsualizarClasificacionMedicaAuditor(db, {
    solicitudId: typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "",
    articuloId: typeof d.articulo_id === "string" ? d.articulo_id.trim() : undefined,
    versionIdAplicada:
      typeof d.version_id_aplicada === "string"
        ? d.version_id_aplicada.trim()
        : typeof d.version_aplicada_id === "string"
          ? d.version_aplicada_id.trim()
          : undefined,
    fechaDesde: typeof d.fecha_desde === "string" ? d.fecha_desde.trim() : undefined,
    fechaHasta: typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim() : undefined,
    causalLargaDuracionId:
      typeof d.causal_larga_duracion_id === "string" ? d.causal_larga_duracion_id.trim() : undefined,
  });

  if (!result.ok) {
    const code =
      result.codigo === "ESTADO_INVALIDO" || result.codigo === "AVISO_INCOMPLETO"
        ? "failed-precondition"
        : "invalid-argument";
    throw new HttpsError(code, result.mensaje || "No se pudo previsualizar la clasificación.");
  }

  return result;
});

module.exports = { previsualizarClasificacionMedicaAuditor: previsualizarClasificacionMedicaAuditorCallable };
