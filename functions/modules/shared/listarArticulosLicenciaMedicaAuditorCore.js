"use strict";

const {
  CFG_MLM_CORTA_ANUAL,
  CFG_MLM_LARGA_EPISODIO,
  leerModoLicenciaMedicaDesdeVersion,
} = require("./licenciaMedicaTramosCore");
const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarArticulosLicenciaMedicaAuditor(db) {
  const snap = await db.collection("cfg_articulos").limit(120).get();
  const articuloCache = new Map();
  /** @type {Array<Record<string, unknown>>} */
  const articulos = [];

  for (const artDoc of snap.docs) {
    const core = artDoc.data() || {};
    const verId = String(core.version_actual_id || "").trim();
    if (!/^ver_/i.test(verId)) continue;

    const verSnap = await artDoc.ref.collection("versiones").doc(verId).get();
    if (!verSnap.exists) continue;
    const vd = verSnap.data() || {};
    const modo = leerModoLicenciaMedicaDesdeVersion(vd);
    if (modo !== CFG_MLM_CORTA_ANUAL && modo !== CFG_MLM_LARGA_EPISODIO) continue;

    const display = await loadArticuloDisplay(db, artDoc.id, articuloCache);
    const codigo = String(core.codigo || display.codigo_grilla || "").trim();

    articulos.push({
      articulo_id: artDoc.id,
      version_id_aplicada: verId,
      codigo,
      nombre: String(display.nombre || core.nombre || "").trim(),
      articulo_label: display.articulo_label,
      codigo_grilla: String(display.codigo_grilla || "").trim(),
      modo_licencia_medica_id: modo,
      es_corta_anual: modo === CFG_MLM_CORTA_ANUAL,
      es_larga_episodio: modo === CFG_MLM_LARGA_EPISODIO,
    });
  }

  articulos.sort((a, b) => {
    const ca = String(a.codigo || "");
    const cb = String(b.codigo || "");
    if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });

  return { articulos };
}

module.exports = { listarArticulosLicenciaMedicaAuditor };
