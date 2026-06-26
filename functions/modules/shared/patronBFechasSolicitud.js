"use strict";

/**
 * Días y fecha_hasta Patrón B — preview / listado / motor.
 * Días **laborables** (hábiles compuesto): calendario institucional (misma fuente que grilla).
 * Corridos: solo cuando la versión declara `cfg_rcd_corridos` (no aplica 63.j).
 */

const { getIndiceCalendario } = require("./calendarService");
const { readModoCalculo } = require("./validarFechasArticuloRuntime");
const { MODO_COMPUTO_CORRIDOS } = require("./modoComputoCalendario");
const {
  buildIndiceEventosCalendario,
  fechaHastaPorDiasCorridosInclusive,
  fechaHastaPorDiasHabilesDesdeIndice,
} = require("./calendarInstitucionalCore");
const {
  versionTieneOpcionesConsumoActivas,
} = require("./opcionesConsumoSolicitud");

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @returns {number}
 */
function diasSolicitadosDesdeVersion(versionData) {
  if (versionTieneOpcionesConsumoActivas(versionData)) {
    return 1;
  }
  const topes =
    versionData && typeof versionData === "object"
      ? versionData.bloque_topes_plazos_computo || {}
      : {};
  const topeEvento = Number(topes.tope_dias_por_evento);
  if (Number.isFinite(topeEvento) && topeEvento > 0) return Math.floor(topeEvento);
  return 1;
}

/**
 * @param {string} fechaDesdeYmd
 * @param {number} diasSolicitados
 * @param {Record<string, unknown>} versionData
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 */
function fechaHastaConIndiceCalendario(fechaDesdeYmd, diasSolicitados, versionData, indice) {
  const desde = String(fechaDesdeYmd || "").slice(0, 10);
  const dias = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;
  if (dias <= 1) return desde;

  const modoCalc = readModoCalculo(versionData);
  if (modoCalc.usaCalendario) {
    const idx = indice || buildIndiceEventosCalendario([]);
    return fechaHastaPorDiasHabilesDesdeIndice(desde, dias, idx, {
      incluyeFeriadosInstitucionales: modoCalc.incluyeFeriadosInstitucionales,
    });
  }
  if (modoCalc.modo === MODO_COMPUTO_CORRIDOS) {
    return fechaHastaPorDiasCorridosInclusive(desde, dias);
  }
  return desde;
}

/**
 * Resolución síncrona (solo si el caller ya cargó el índice; p. ej. tests).
 * @param {string} fechaDesdeYmd
 * @param {number} diasSolicitados
 * @param {Record<string, unknown> | null | undefined} [versionData]
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> } | null} [indice]
 */
function fechaHastaDesdeVersionPatronB(fechaDesdeYmd, diasSolicitados, versionData, indice = null) {
  if (!versionData || typeof versionData !== "object") {
    const desde = String(fechaDesdeYmd || "").slice(0, 10);
    const dias = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;
    return dias <= 1 ? desde : desde;
  }
  return fechaHastaConIndiceCalendario(fechaDesdeYmd, diasSolicitados, versionData, indice);
}

/**
 * Fuente de verdad operativa: índice desde Firestore (`config/calendario_institucional`).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} fechaDesdeYmd
 * @param {number} diasSolicitados
 * @param {Record<string, unknown>} versionData
 */
async function fechaHastaDesdeVersionPatronBAsync(db, fechaDesdeYmd, diasSolicitados, versionData) {
  const desde = String(fechaDesdeYmd || "").slice(0, 10);
  const dias = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;
  if (dias <= 1) return desde;

  const modoCalc = readModoCalculo(versionData);
  if (modoCalc.usaCalendario && modoCalc.incluyeFeriadosInstitucionales) {
    const indice = await getIndiceCalendario();
    return fechaHastaConIndiceCalendario(desde, dias, versionData, indice);
  }
  if (modoCalc.usaCalendario) {
    return fechaHastaConIndiceCalendario(desde, dias, versionData, buildIndiceEventosCalendario([]));
  }
  if (modoCalc.modo === MODO_COMPUTO_CORRIDOS) {
    return fechaHastaPorDiasCorridosInclusive(desde, dias);
  }
  return desde;
}

module.exports = {
  diasSolicitadosDesdeVersion,
  fechaHastaDesdeVersionPatronB,
  fechaHastaDesdeVersionPatronBAsync,
  fechaHastaConIndiceCalendario,
};
