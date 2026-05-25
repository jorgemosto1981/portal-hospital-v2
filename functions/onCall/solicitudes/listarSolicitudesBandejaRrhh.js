"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");
const { listarSolicitudesBandejaRrhh } = require("../../modules/shared/solicitudBandejaRrhhCore");

const listarSolicitudesBandejaRrhhCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const token = request.auth.token || {};
  if (!tokenHasRrhhLaborAccess(token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede acceder a esta bandeja.");
  }

  const data = request.data && typeof request.data === "object" ? request.data : {};
  return listarSolicitudesBandejaRrhh(db, data);
});

module.exports = { listarSolicitudesBandejaRrhh: listarSolicitudesBandejaRrhhCallable };
