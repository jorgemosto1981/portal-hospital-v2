"use strict";

const {
  esLicenciaMedicaLargaEpisodio,
} = require("./licenciaMedicaTramosCore");
const { FASE_MOTOR_S_MED_LARGA } = require("./licenciaMedicaEpisodioCore");

const COL_CAUSAL_LARGA = "cfg_causal_larga_duracion";

/**
 * @param {Record<string, unknown>} sol
 */
function resolverCie10DesdeSolBandeja(sol) {
  const c = sol.cie10;
  if (!c || typeof c !== "object") return { codigo: null, descripcion: null };
  const codigo = String(c.codigo || "").trim() || null;
  const descripcion = String(c.descripcion || "").trim() || null;
  if (!codigo && !descripcion) return { codigo: null, descripcion: null };
  return { codigo, descripcion };
}

/**
 * @param {Record<string, unknown>} sol
 */
function resolverCausalLargaIdDesdeSol(sol) {
  const lm =
    sol.licencia_medica && typeof sol.licencia_medica === "object" ? sol.licencia_medica : null;
  const desdeLm =
    lm && typeof lm.causal_larga_duracion_id === "string" ? lm.causal_larga_duracion_id : "";
  const id = String(sol.causal_larga_duracion_id || desdeLm || "").trim();
  return /^cfg_cld_/i.test(id) ? id : null;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} causalId
 * @param {Map<string, string>} cache
 */
async function loadCausalLargaTituloUi(db, causalId, cache) {
  const id = String(causalId || "").trim();
  if (!/^cfg_cld_/i.test(id)) return null;
  if (cache.has(id)) return cache.get(id) || null;
  const snap = await db.collection(COL_CAUSAL_LARGA).doc(id).get();
  const titulo = snap.exists
    ? String(snap.data()?.titulo_ui || snap.data()?.nombre || id).trim()
    : id;
  cache.set(id, titulo);
  return titulo || null;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {string} versionId
 * @param {Map<string, { esLarga: boolean }>} cache
 */
async function versionEsLicenciaLargaEpisodio(db, articuloId, versionId, cache) {
  const art = String(articuloId || "").trim();
  const ver = String(versionId || "").trim();
  if (!/^art_/i.test(art) || !/^ver_/i.test(ver)) return false;
  const k = `${art}|${ver}`;
  if (cache.has(k)) return cache.get(k).esLarga === true;
  const snap = await db.collection("cfg_articulos").doc(art).collection("versiones").doc(ver).get();
  const esLarga = snap.exists && esLicenciaMedicaLargaEpisodio(snap.data());
  cache.set(k, { esLarga });
  return esLarga;
}

/**
 * Metadatos de licencia larga para ítems de bandeja auditor (solo lectura).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} sol
 * @param {{ articuloId: string, versionId: string }} ctx
 * @param {{ causalCache: Map<string, string>, versionCache: Map<string, { esLarga: boolean }> }} caches
 */
async function enriquecerItemBandejaAuditorLarga(db, sol, ctx, caches) {
  const cie10 = resolverCie10DesdeSolBandeja(sol);
  const causalId = resolverCausalLargaIdDesdeSol(sol);
  const versionLarga = await versionEsLicenciaLargaEpisodio(
    db,
    ctx.articuloId,
    ctx.versionId,
    caches.versionCache,
  );
  const es_licencia_larga =
    versionLarga || Boolean(causalId && cie10.codigo && cie10.descripcion);

  let causal_larga_nombre = null;
  if (causalId) {
    causal_larga_nombre = await loadCausalLargaTituloUi(db, causalId, caches.causalCache);
  }

  return {
    es_licencia_larga,
    fase_motor: es_licencia_larga ? FASE_MOTOR_S_MED_LARGA : null,
    cie10_codigo: cie10.codigo,
    cie10_descripcion: cie10.descripcion,
    causal_larga_duracion_id: causalId,
    causal_larga_nombre,
  };
}

module.exports = {
  resolverCie10DesdeSolBandeja,
  resolverCausalLargaIdDesdeSol,
  enriquecerItemBandejaAuditorLarga,
  loadCausalLargaTituloUi,
};
