"use strict";

/**
 * Familia Art. 64 (asuntos particulares) — pares con/sin goce por configuración.
 *
 * Fuente de verdad en `cfg_articulos/{art_*}`:
 *   familia_64_par_articulo_id: art_* del par de modalidad (A↔B)
 *   es_sin_goce: dirección del par
 *
 * Cupos, escalafón y topes salen de la versión publicada — no hardcodear.
 *
 * Fallback legacy: si falta el campo, el par canónico Etapa1 (ADMIN 6 días) sigue operando.
 */

const {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
} = require("./etapa1RuntimeConfig");

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeArtId(raw) {
  const id = String(raw || "").trim();
  return /^art_/i.test(id) ? id : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} core
 * @returns {string|null}
 */
function familia64ParIdDesdeCore(core) {
  if (!core || typeof core !== "object") return null;
  return normalizeArtId(core.familia_64_par_articulo_id);
}

/**
 * Resuelve el par familia 64 desde el núcleo del artículo.
 * @param {string} articuloId
 * @param {Record<string, unknown> | null | undefined} core
 * @returns {{
 *   enFamilia: boolean,
 *   conGoceId: string|null,
 *   sinGoceId: string|null,
 *   esSinGoce: boolean,
 *   legacy: boolean,
 * }}
 */
function resolveFamilia64Pair(articuloId, core) {
  const id = normalizeArtId(articuloId);
  if (!id) {
    return { enFamilia: false, conGoceId: null, sinGoceId: null, esSinGoce: false, legacy: false };
  }

  const par = familia64ParIdDesdeCore(core);
  if (par) {
    const esSinGoce = core?.es_sin_goce === true;
    return {
      enFamilia: true,
      conGoceId: esSinGoce ? par : id,
      sinGoceId: esSinGoce ? id : par,
      esSinGoce,
      legacy: false,
    };
  }

  // Legacy Etapa1 — solo mientras el core no tenga el par configurado.
  if (id === ARTICULO_64A_ETAPA1_ID) {
    return {
      enFamilia: true,
      conGoceId: ARTICULO_64A_ETAPA1_ID,
      sinGoceId: ARTICULO_64B_ETAPA1_ID,
      esSinGoce: false,
      legacy: true,
    };
  }
  if (id === ARTICULO_64B_ETAPA1_ID) {
    return {
      enFamilia: true,
      conGoceId: ARTICULO_64A_ETAPA1_ID,
      sinGoceId: ARTICULO_64B_ETAPA1_ID,
      esSinGoce: true,
      legacy: true,
    };
  }

  return { enFamilia: false, conGoceId: null, sinGoceId: null, esSinGoce: false, legacy: false };
}

/**
 * Snapshot en sol_* o heurística por ids de par / código grilla.
 * @param {Record<string, unknown> | null | undefined} sol
 * @param {Record<string, unknown> | null | undefined} [core]
 */
function resolveFamilia64DesdeSolicitud(sol, core) {
  const art = normalizeArtId(sol?.articulo_id);
  const conSnap = normalizeArtId(sol?.articulo_id_con_goce);
  const sinSnap = normalizeArtId(sol?.articulo_id_sin_goce);
  if (sol?.articulo_familia_64 === true && conSnap && sinSnap) {
    const esSinGoce = art === sinSnap || sol?.es_sin_goce === true;
    return {
      enFamilia: true,
      conGoceId: conSnap,
      sinGoceId: sinSnap,
      esSinGoce,
      legacy: false,
    };
  }
  if (core) return resolveFamilia64Pair(art || "", core);
  if (art) return resolveFamilia64Pair(art, null);
  const cod = String(sol?.codigo_grilla || "")
    .trim()
    .toUpperCase();
  if (cod === "64" || cod.startsWith("64")) {
    return {
      enFamilia: true,
      conGoceId: ARTICULO_64A_ETAPA1_ID,
      sinGoceId: ARTICULO_64B_ETAPA1_ID,
      esSinGoce: cod.includes("B") || Boolean(sol?.es_sin_goce),
      legacy: true,
    };
  }
  return { enFamilia: false, conGoceId: null, sinGoceId: null, esSinGoce: false, legacy: false };
}

/**
 * ¿Ocultar del listado de ingreso agente? (solo entra el con goce del par).
 * @param {Record<string, unknown> | null | undefined} core
 * @param {string} articuloId
 */
function esIngresoFamilia64Oculto(core, articuloId) {
  const pair = resolveFamilia64Pair(articuloId, core);
  return pair.enFamilia && pair.esSinGoce === true;
}

/**
 * ¿Mostrar como chip unificado familia 64 (carril con goce)?
 * @param {Record<string, unknown> | null | undefined} core
 * @param {string} articuloId
 */
function esIngresoFamilia64ConGoce(core, articuloId) {
  const pair = resolveFamilia64Pair(articuloId, core);
  return pair.enFamilia && pair.esSinGoce === false;
}

/**
 * Carga núcleo cfg_articulos.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 */
async function loadArticuloCore(db, articuloId) {
  const id = normalizeArtId(articuloId);
  if (!id) return null;
  const snap = await db.collection("cfg_articulos").doc(id).get();
  if (!snap.exists) return null;
  return snap.data() || {};
}

/**
 * Resuelve par cargando core si hace falta.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @param {Record<string, unknown> | null | undefined} [coreHint]
 */
async function resolveFamilia64PairAsync(db, articuloId, coreHint) {
  const id = normalizeArtId(articuloId);
  if (!id) {
    return { enFamilia: false, conGoceId: null, sinGoceId: null, esSinGoce: false, legacy: false };
  }
  let core = coreHint && typeof coreHint === "object" ? coreHint : null;
  if (!core || familia64ParIdDesdeCore(core) == null) {
    // Si el hint no trae par, igual intentar resolve (legacy); solo fetch si hace falta.
    const resolved = resolveFamilia64Pair(id, core);
    if (resolved.enFamilia && !resolved.legacy) return resolved;
    if (resolved.enFamilia && resolved.legacy) return resolved;
    core = await loadArticuloCore(db, id);
  }
  return resolveFamilia64Pair(id, core);
}

module.exports = {
  ARTICULO_64A_ETAPA1_ID,
  ARTICULO_64B_ETAPA1_ID,
  normalizeArtId,
  familia64ParIdDesdeCore,
  resolveFamilia64Pair,
  resolveFamilia64DesdeSolicitud,
  esIngresoFamilia64Oculto,
  esIngresoFamilia64ConGoce,
  loadArticuloCore,
  resolveFamilia64PairAsync,
};
