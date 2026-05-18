"use strict";

/**
 * Cierre check-in global (mismo contrato que cerrarCheckinSaldosPortal).
 * Nombre distinto para evitar servicio Cloud Run con IAM roto del primer deploy.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");

const cerrarCheckinGlobal = onCall({ invoker: "public" }, async (request) => {
  try {
    if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
      throw new HttpsError("permission-denied", "Solo RRHH puede cerrar el check-in global.");
    }
    const d = request.data && typeof request.data === "object" ? request.data : {};
    const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
    const anioCorteA = Number(d.anio_corte_a);

    if (!/^per_/i.test(personaId)) {
      throw new HttpsError("invalid-argument", "persona_id inválido.");
    }
    if (!Number.isInteger(anioCorteA) || anioCorteA < 1900) {
      throw new HttpsError("invalid-argument", "anio_corte_a inválido.");
    }

    const ref = db.collection("personas").doc(personaId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Persona no encontrada.");
    }

    await ref.set(
      {
        anio_corte_portal_a: anioCorteA,
        checkin_saldos_portal_en: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true, persona_id: personaId, anio_corte_a: anioCorteA };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cerrarCheckinGlobal", err);
    throw new HttpsError("internal", msg || "Error al cerrar check-in global.");
  }
});

module.exports = { cerrarCheckinGlobal };
