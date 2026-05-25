"use strict";

const {
  pickPublishedVersionByCorrespondenciaAnio,
} = require("./laoVersionResolver");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 */
async function loadVersionDocsForArticulo(db, articuloId) {
  const snap = await db
    .collection("cfg_articulos")
    .doc(String(articuloId).trim())
    .collection("versiones")
    .get();
  return snap.docs;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {number} correspondenciaAnio
 */
async function resolvePublishedLaoVersion(db, articuloId, correspondenciaAnio) {
  const docs = await loadVersionDocsForArticulo(db, articuloId);
  const pick = pickPublishedVersionByCorrespondenciaAnio(docs, correspondenciaAnio);
  if (!pick) {
    const err = new Error(
      `No hay versión LAO publicada con correspondencia_anio=${correspondenciaAnio} para el artículo ${articuloId}.`,
    );
    err.code = "not-found";
    throw err;
  }
  return pick;
}

module.exports = {
  loadVersionDocsForArticulo,
  resolvePublishedLaoVersion,
};
