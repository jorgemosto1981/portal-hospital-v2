"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAgenteConPersonaId } = require("../../modules/shared/helpers");
const { validarPeriodoExclusivoAvisoMedico } = require("../../modules/shared/avisoMedicoExclusividadValidacion");

const validarPeriodoAvisoMedicoExclusivo = onCall(async (request) => {
  const titularPersonaId = assertAgenteConPersonaId(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim() : "";
  const fechaHasta = typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim() : "";
  const excludeSolicitudId =
    typeof d.exclude_solicitud_id === "string" ? d.exclude_solicitud_id.trim() : "";

  const result = await validarPeriodoExclusivoAvisoMedico(db, {
    titularPersonaId,
    fechaDesde,
    fechaHasta: fechaHasta || fechaDesde,
    excludeSolicitudId,
  });

  if (!result.ok) {
    throw new HttpsError("failed-precondition", result.mensaje || "Período no disponible.");
  }
  return result;
});

module.exports = { validarPeriodoAvisoMedicoExclusivo };
