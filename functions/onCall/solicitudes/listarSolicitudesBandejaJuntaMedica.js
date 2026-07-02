"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertJuntaMedica } = require("../../modules/shared/juntaMedicaLaborAccess");
const {
  listarSolicitudesBandejaJuntaMedica,
} = require("../../modules/shared/solicitudBandejaJuntaMedicaCore");

const listarSolicitudesBandejaJuntaMedicaCallable = onCall(async (request) => {
  assertJuntaMedica(request);
  const data = request.data && typeof request.data === "object" ? request.data : {};
  return listarSolicitudesBandejaJuntaMedica(db, data);
});

module.exports = {
  listarSolicitudesBandejaJuntaMedica: listarSolicitudesBandejaJuntaMedicaCallable,
};
