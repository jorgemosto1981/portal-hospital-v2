"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhAccess, serializeFirestoreValue } = require("../../modules/shared/helpers");

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede consultar saldos de check-in.");
  }
}

const obtenerSaldosCheckinPersona = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const anioCorteA = Number(d.anio_corte_a);

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
    throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
  }

  const snap = await db.collection("saldos_articulo_agente").where("persona_id", "==", personaId).get();

  const docs = snap.docs.map((docSnap) => {
    const flat = serializeFirestoreValue(docSnap.data() || {});
    const data = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { id: docSnap.id, ...data };
  });

  return { ok: true, persona_id: personaId, anio_corte_a: anioCorteA, docs };
});

module.exports = { obtenerSaldosCheckinPersona };
