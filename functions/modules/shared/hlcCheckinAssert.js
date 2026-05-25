"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { isHlcOperativo } = require("./hlcOperativo");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 */
async function countHlcOperativosPersona(db, personaId) {
  const snap = await db
    .collection("historial_laboral_cargos")
    .where("persona_id", "==", personaId)
    .get();
  return snap.docs.filter((d) => isHlcOperativo(d.data())).length;
}

/**
 * Check-in nuevo: al menos un HLc operativo en servidor (no confiar solo en checkbox FE).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {{ skip?: boolean }} [opts]
 */
async function assertHlcOperativoCheckinNuevo(db, personaId, opts = {}) {
  if (opts.skip === true) return;
  const n = await countHlcOperativosPersona(db, personaId);
  if (n < 1) {
    throw new HttpsError(
      "failed-precondition",
      "La persona no tiene HLc operativo vigente. Completá datos laborales antes del check-in nuevo.",
    );
  }
}

module.exports = { assertHlcOperativoCheckinNuevo, countHlcOperativosPersona };
