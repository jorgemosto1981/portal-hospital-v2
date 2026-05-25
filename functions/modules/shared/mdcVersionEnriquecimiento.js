"use strict";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} p
 */
async function enriquecerPayloadMdcDesdeVersion(db, p) {
  const versionId = String(p.version_id_aplicada || "").trim();
  const articuloId = String(p.articulo_id || "").trim();
  if (!versionId || !articuloId) return p;

  const snap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  if (!snap.exists) return p;

  const topes = snap.data()?.bloque_topes_plazos_computo || {};
  return {
    ...p,
    nivel_ocupacion_dia_id: String(topes.nivel_ocupacion_dia_id || "").trim() || null,
    politica_superposicion_id: String(topes.politica_superposicion_id || "").trim() || null,
  };
}

module.exports = { enriquecerPayloadMdcDesdeVersion };
