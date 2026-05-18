"use strict";

/**
 * @deprecated Desde el cliente web usar `cerrarCheckinGlobal` (mismo contrato).
 * Se mantiene exportado por compatibilidad de deploys/IAM históricos.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede cerrar el check-in global.");
  }
}

/** `invoker: public` explícito: el primer deploy falló IAM y el servicio quedó sin invocación desde el SDK web. */
const cerrarCheckinSaldosPortal = onCall({ invoker: "public" }, async (request) => {
  try {
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
    console.error("cerrarCheckinSaldosPortal", err);
    throw new HttpsError("internal", msg || "Error al cerrar check-in global.");
  }
});

module.exports = { cerrarCheckinSaldosPortal };
