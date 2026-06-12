"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { descartarMarcaHuerfanaReloj } = require("../../modules/fichadas/fichadasHuerfanasBandejaCore");

const descartarMarcaHuerfanaRelojCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth?.token || {};

  try {
    const result = await descartarMarcaHuerfanaReloj(
      db,
      { fmh_id: d.fmh_id, motivo: d.motivo },
      {
        actor_uid: request.auth?.uid || null,
        actor_persona_id: typeof token.persona_id === "string" ? token.persona_id : null,
      },
    );
    if (!result.ok) {
      const code = result.codigo === "NO_ENCONTRADO" ? "not-found" : "invalid-argument";
      throw new HttpsError(code, result.mensaje || "No se pudo descartar.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("descartarMarcaHuerfanaReloj", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al descartar.");
  }
});

module.exports = { descartarMarcaHuerfanaReloj: descartarMarcaHuerfanaRelojCallable };
