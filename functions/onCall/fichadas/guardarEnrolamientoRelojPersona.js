"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { assertRrhh } = require("../../modules/shared/helpers");
const { guardarEnrolamientoRelojPersona } = require("../../modules/fichadas/relojEnrolamientoCore");

const guardarEnrolamientoRelojPersonaCallable = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const token = request.auth?.token || {};

  try {
    const result = await guardarEnrolamientoRelojPersona(
      db,
      {
        reloj_id: d.reloj_id,
        numero_tarjeta: d.numero_tarjeta,
        persona_id: d.persona_id,
        grupo_trabajo_id: d.grupo_trabajo_id || d.grupo_id,
      },
      {
        actor_uid: request.auth?.uid || null,
        actor_persona_id: typeof token.persona_id === "string" ? token.persona_id : null,
      },
    );
    if (!result.ok) {
      throw new HttpsError("invalid-argument", result.mensaje || "Enrolamiento inválido.", {
        codigo: result.codigo,
        requiere_seleccion: result.requiere_seleccion,
      });
    }
    return result;
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("guardarEnrolamientoRelojPersona", err);
    throw new HttpsError("internal", err instanceof Error ? err.message : "Error al guardar enrolamiento.");
  }
});

module.exports = { guardarEnrolamientoRelojPersona: guardarEnrolamientoRelojPersonaCallable };
