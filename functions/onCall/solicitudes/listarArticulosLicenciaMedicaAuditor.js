"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const {
  listarArticulosLicenciaMedicaAuditor,
} = require("../../modules/shared/listarArticulosLicenciaMedicaAuditorCore");

const listarArticulosLicenciaMedicaAuditorCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  return listarArticulosLicenciaMedicaAuditor(db);
});

module.exports = { listarArticulosLicenciaMedicaAuditor: listarArticulosLicenciaMedicaAuditorCallable };
