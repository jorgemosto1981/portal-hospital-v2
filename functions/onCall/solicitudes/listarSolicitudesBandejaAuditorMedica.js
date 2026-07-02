"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const {
  listarSolicitudesBandejaAuditorMedica,
} = require("../../modules/shared/solicitudBandejaAuditorMedicaCore");

const listarSolicitudesBandejaAuditorMedicaCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  const data = request.data && typeof request.data === "object" ? request.data : {};
  return listarSolicitudesBandejaAuditorMedica(db, data);
});

module.exports = {
  listarSolicitudesBandejaAuditorMedica: listarSolicitudesBandejaAuditorMedicaCallable,
};
