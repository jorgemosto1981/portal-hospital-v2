"use strict";

const { onCall } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertAuditorMedico } = require("../../modules/shared/auditorMedicoLaborAccess");
const {
  listarCausalLargaBandejaAuditor,
} = require("../../modules/shared/listarCausalLargaBandejaAuditorCore");

const listarCausalLargaBandejaAuditorCallable = onCall(async (request) => {
  assertAuditorMedico(request);
  return listarCausalLargaBandejaAuditor(db);
});

module.exports = { listarCausalLargaBandejaAuditor: listarCausalLargaBandejaAuditorCallable };
