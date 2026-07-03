"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const { listarCie10BandejaAuditor } = require("../../modules/shared/listarCie10BandejaAuditorCore");

const listarCie10BandejaAuditorCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  return listarCie10BandejaAuditor(db);
});

module.exports = { listarCie10BandejaAuditor: listarCie10BandejaAuditorCallable };
