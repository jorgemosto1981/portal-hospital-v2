"use strict";

const { parseYmd } = require("./laoPreviewMotor");
const { PATRON_SALDO_B } = require("./resolvePatronSaldo");
const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
} = require("./solicitudElegibilidadLaboral");
const { loadHlcArray, patronFromVersion } = require("./solicitudPatronBAltaMotor");
const { ARTICULO_IDS_MVP } = require("./ticketeraArticulosMvp");
const {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronB,
} = require("./patronBFechasSolicitud");

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} articuloId
 * @returns {Promise<{ articuloId: string, core: Record<string, unknown>, versionData: Record<string, unknown>, versionId: string } | null>}
 */
async function loadArticuloPatronBVersionPublicada(db, articuloId) {
  const artRef = db.collection("cfg_articulos").doc(articuloId);
  const [artSnap, verSnap] = await Promise.all([
    artRef.get(),
    artRef
      .collection("versiones")
      .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
      .limit(1)
      .get(),
  ]);
  if (!artSnap.exists || verSnap.empty) return null;

  const versionData = verSnap.docs[0].data() || {};
  if (patronFromVersion(versionData) !== PATRON_SALDO_B) return null;

  return {
    articuloId,
    core: artSnap.data() || {},
    versionData,
    versionId: verSnap.docs[0].id,
  };
}

/**
 * Descubre artículos Patrón B con versión publicada (1 query collection group + get batch).
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function discoverArticulosPatronBPublicados(db) {
  const verSnap = await db
    .collectionGroup("versiones")
    .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
    .get();

  /** @type {Map<string, { versionData: Record<string, unknown>, versionId: string }>} */
  const porArticulo = new Map();
  for (const verDoc of verSnap.docs) {
    const articuloId = verDoc.ref.parent?.parent?.id;
    if (!articuloId || porArticulo.has(articuloId)) continue;
    const versionData = verDoc.data() || {};
    if (patronFromVersion(versionData) !== PATRON_SALDO_B) continue;
    porArticulo.set(articuloId, { versionData, versionId: verDoc.id });
  }

  const ids = [...porArticulo.keys()];
  if (!ids.length) return [];

  const artSnaps = await db.getAll(...ids.map((id) => db.collection("cfg_articulos").doc(id)));
  /** @type {Array<{ articuloId: string, core: Record<string, unknown>, versionData: Record<string, unknown>, versionId: string }>} */
  const out = [];
  for (const artSnap of artSnaps) {
    if (!artSnap.exists) continue;
    const meta = porArticulo.get(artSnap.id);
    if (!meta) continue;
    out.push({
      articuloId: artSnap.id,
      core: artSnap.data() || {},
      versionData: meta.versionData,
      versionId: meta.versionId,
    });
  }
  return out;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function cargarCandidatosPatronB(db) {
  if (ARTICULO_IDS_MVP.length > 0) {
    const loaded = await Promise.all(ARTICULO_IDS_MVP.map((id) => loadArticuloPatronBVersionPublicada(db, id)));
    return loaded.filter(Boolean);
  }
  return discoverArticulosPatronBPublicados(db);
}

/**
 * @param {{
 *   db: import("firebase-admin/firestore").Firestore,
 *   personaId: string,
 *   fechaDesde: string,
 *   authToken?: unknown,
 * }} params
 */
async function listarArticulosIngresoPatronB(params) {
  const { db, personaId, fechaDesde, authToken } = params;
  if (!parseYmd(fechaDesde)) {
    return { error: "invalid-argument", message: "fecha_desde debe ser YYYY-MM-DD." };
  }

  const personaSnap = await db.collection("personas").doc(personaId).get();
  if (!personaSnap.exists) {
    return { error: "not-found", message: "La persona no existe." };
  }
  const persona = personaSnap.data() || {};
  const hlcArray = await loadHlcArray(db, personaId);
  const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, fechaDesde);
  const diasExt = Number(persona.antiguedad_reconocida_dias);
  const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

  const candidatos = await cargarCandidatosPatronB(db);
  /** @type {Array<object>} */
  const articulos = [];
  /** @type {{ codigos: string[], mensajes: string[] } | null} */
  let elegibilidadVacia = null;

  for (const cand of candidatos) {
    const { articuloId, core, versionData, versionId } = cand;
    const eleg = resolverElegibilidadSolicitud({
      versionData,
      hlcVigentes,
      personaId,
      fechaDesde,
      diasExternos: externos,
      authToken,
    });
    if (!eleg.ok) {
      if (!elegibilidadVacia && Array.isArray(eleg.codigos) && eleg.codigos.length) {
        elegibilidadVacia = {
          codigos: eleg.codigos,
          mensajes: Array.isArray(eleg.mensajes) ? eleg.mensajes : [],
        };
      }
      continue;
    }

    const diasSolicitados = diasSolicitadosDesdeVersion(versionData);
    const fechaHasta = fechaHastaDesdeVersionPatronB(fechaDesde, diasSolicitados);

    articulos.push({
      articulo_id: articuloId,
      version_id: versionId,
      codigo_grilla: String(core.codigo || core.nombre_corto || "").trim() || "ART",
      nombre: String(core.nombre || core.codigo || "").trim(),
      patron_saldo: PATRON_SALDO_B,
      dias_solicitados: diasSolicitados,
      fecha_hasta: fechaHasta,
    });
  }

  return {
    articulos,
    fecha_desde: fechaDesde,
    persona_id: personaId,
    ...(elegibilidadVacia && articulos.length === 0 ? { elegibilidad_vacia: elegibilidadVacia } : {}),
  };
}

module.exports = {
  listarArticulosIngresoPatronB,
  loadArticuloPatronBVersionPublicada,
  discoverArticulosPatronBPublicados,
};
