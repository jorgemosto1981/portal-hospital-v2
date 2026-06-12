"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { listarCfgRelojBiometrico } = require("../../modules/fichadas/cfgRelojBiometricoCore");

const listarCfgRelojBiometricoCallable = onCall(async (request) => {
  assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  try {
    return await listarCfgRelojBiometrico(db, { incluir_inactivos: d.incluir_inactivos });
  } catch (err) {
    console.error("listarCfgRelojBiometrico", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al listar relojes.");
  }
});

module.exports = { listarCfgRelojBiometrico: listarCfgRelojBiometricoCallable };
