"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { listarEnrolamientoRelojPorPersona } = require("../../modules/fichadas/listarEnrolamientoRelojCore");

const listarEnrolamientoRelojPorPersonaCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  try {
    const result = await listarEnrolamientoRelojPorPersona(db, {
      persona_id: d.persona_id,
      incluir_inactivos: d.incluir_inactivos,
      limite: d.limite,
    });
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Consulta inválida.");
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("listarEnrolamientoRelojPorPersona", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al consultar enrolamiento.");
  }
});

module.exports = { listarEnrolamientoRelojPorPersona: listarEnrolamientoRelojPorPersonaCallable };
