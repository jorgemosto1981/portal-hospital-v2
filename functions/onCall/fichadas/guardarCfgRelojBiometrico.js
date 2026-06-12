"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { guardarCfgRelojBiometrico } = require("../../modules/fichadas/cfgRelojBiometricoCore");

const guardarCfgRelojBiometricoCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth?.token || {};

  try {
    const result = await guardarCfgRelojBiometrico(db, d, {
      actor_uid: request.auth?.uid || null,
      actor_persona_id: typeof token.persona_id === "string" ? token.persona_id : null,
    });
    if (!result.ok) {
      const code = result.codigo === "NO_ENCONTRADO" ? "not-found" : "invalid-argument";
      throw new HttpsError(code, result.mensaje || "Configuración de reloj inválida.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("guardarCfgRelojBiometrico", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al guardar reloj.");
  }
});

module.exports = { guardarCfgRelojBiometrico: guardarCfgRelojBiometricoCallable };
