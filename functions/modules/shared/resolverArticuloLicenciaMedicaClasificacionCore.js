"use strict";

const { CFG_MLM_CORTA_ANUAL, CFG_MLM_LARGA_EPISODIO } = require("./licenciaMedicaTramosCore");

/**
 * @param {unknown} versionData
 * @param {string} modoEsperado
 */
function versionCoincideModoLicencia(versionData, modoEsperado) {
  const ident =
    versionData && typeof versionData === "object" ? versionData.bloque_identidad_naturaleza : null;
  if (!ident || ident.es_licencia_medica !== true) return false;
  const modo = String(ident.modo_licencia_medica_id || "").trim();
  if (modo === modoEsperado) return true;
  if (!modo && modoEsperado === CFG_MLM_CORTA_ANUAL) return true;
  return false;
}

/**
 * @param {import("firebase-admin/firestore").DocumentReference} artRef
 * @param {string} modoEsperado
 */
async function resolverDesdeArticulo(artRef, modoEsperado) {
  const artSnap = await artRef.get();
  if (!artSnap.exists) return null;
  const core = artSnap.data() || {};
  const verPub = String(core.version_actual_id || "").trim();
  if (/^ver_/i.test(verPub)) {
    const verSnap = await artRef.collection("versiones").doc(verPub).get();
    if (verSnap.exists && versionCoincideModoLicencia(verSnap.data(), modoEsperado)) {
      return { articuloId: artRef.id, versionId: verPub };
    }
  }
  const verSnap = await artRef.collection("versiones").orderBy("vigente_desde", "desc").limit(8).get();
  for (const ver of verSnap.docs) {
    if (versionCoincideModoLicencia(ver.data(), modoEsperado)) {
      return { articuloId: artRef.id, versionId: ver.id };
    }
  }
  return null;
}

/**
 * Resuelve artículo + versión publicada para clasificación médica (Caja Negra).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {"corta" | "larga"} modo
 */
async function resolverArticuloLicenciaMedicaPublicado(db, modo) {
  const modoEsperado = modo === "larga" ? CFG_MLM_LARGA_EPISODIO : CFG_MLM_CORTA_ANUAL;
  const codigoNormativo = modo === "larga" ? "16" : "14";

  const byCodigo = await db.collection("cfg_articulos").where("codigo", "==", codigoNormativo).limit(5).get();
  for (const artDoc of byCodigo.docs) {
    const hit = await resolverDesdeArticulo(artDoc.ref, modoEsperado);
    if (hit) return hit;
  }

  const arts = await db.collection("cfg_articulos").limit(80).get();
  for (const artDoc of arts.docs) {
    const hit = await resolverDesdeArticulo(artDoc.ref, modoEsperado);
    if (hit) return hit;
  }
  return null;
}

module.exports = {
  resolverArticuloLicenciaMedicaPublicado,
  versionCoincideModoLicencia,
};
