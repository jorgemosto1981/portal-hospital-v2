"use strict";

const { db } = require("./context");
const {
  buildIndiceEventosCalendario,
  contarDiasHabilesDesdeIndice,
  esDiaHabilDesdeIndice,
  getInfoDiaDesdeIndice,
  normalizarYmdCalendario,
  obtenerProximoDiaHabilDesdeIndice,
} = require("./calendarInstitucionalCore");

const CONFIG_DOC_PATH = ["config", "calendario_institucional"];
const SUB_EVENTOS = "eventos";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {{ indice: { porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> } | null, loadedAt: number, loading: Promise<void> | null }} */
const cache = {
  indice: null,
  loadedAt: 0,
  loading: null,
};

function eventosCollectionRef() {
  return db.collection(CONFIG_DOC_PATH[0]).doc(CONFIG_DOC_PATH[1]).collection(SUB_EVENTOS);
}

/**
 * @returns {Promise<{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }>}
 */
async function getIndiceCalendario(force = false) {
  const now = Date.now();
  if (!force && cache.indice && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.indice;
  }
  if (!force && cache.loading) {
    await cache.loading;
    return cache.indice;
  }

  cache.loading = (async () => {
    const snap = await eventosCollectionRef().get();
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
    cache.indice = buildIndiceEventosCalendario(docs);
    cache.loadedAt = Date.now();
    cache.loading = null;
  })();

  await cache.loading;
  return cache.indice;
}

function invalidateCacheCalendario() {
  cache.indice = null;
  cache.loadedAt = 0;
  cache.loading = null;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} [_db]
 * @param {string} fecha YYYY-MM-DD
 */
async function esDiaHabil(fecha, _db) {
  const indice = await getIndiceCalendario();
  return esDiaHabilDesdeIndice(fecha, indice);
}

/**
 * @param {string} fecha
 */
async function getInfoDia(fecha) {
  const indice = await getIndiceCalendario();
  return getInfoDiaDesdeIndice(fecha, indice);
}

/**
 * @param {string} fechaInicio
 * @param {string} fechaFin
 */
async function contarDiasHabiles(fechaInicio, fechaFin) {
  const indice = await getIndiceCalendario();
  return contarDiasHabilesDesdeIndice(fechaInicio, fechaFin, indice);
}

/**
 * @param {string} fecha
 */
async function obtenerProximoDiaHabil(fecha) {
  const indice = await getIndiceCalendario();
  return obtenerProximoDiaHabilDesdeIndice(fecha, indice);
}

/**
 * RRHH / callables: invalidar cache tras escritura.
 */
function invalidateCalendarioInstitucionalCache() {
  invalidateCacheCalendario();
}

module.exports = {
  CONFIG_DOC_PATH,
  SUB_EVENTOS,
  eventosCollectionRef,
  getIndiceCalendario,
  invalidateCalendarioInstitucionalCache,
  esDiaHabil,
  getInfoDia,
  contarDiasHabiles,
  obtenerProximoDiaHabil,
  normalizarYmdCalendario,
};
