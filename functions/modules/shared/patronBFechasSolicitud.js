"use strict";

/**
 * Días y fecha_hasta Patrón B para listado / preview (sin persistir).
 * Multi-día en corridos: fecha_desde + (dias - 1) calendario.
 */

const { readModoCalculo } = require("./validarFechasArticuloRuntime");
const { MODO_COMPUTO_CORRIDOS } = require("./modoComputoCalendario");
const { fechaHastaPorDiasCorridosInclusive } = require("./calendarInstitucionalCore");
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
 * @param {Record<string, unknown> | null | undefined} [versionData]
 * @returns {string}
 */
function fechaHastaDesdeVersionPatronB(fechaDesdeYmd, diasSolicitados, versionData) {
  const desde = String(fechaDesdeYmd || "").slice(0, 10);
  const dias = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;
  if (dias <= 1) return desde;

  if (versionData && typeof versionData === "object") {
    const modo = readModoCalculo(versionData).modo;
    if (modo === MODO_COMPUTO_CORRIDOS) {
      return fechaHastaPorDiasCorridosInclusive(desde, dias);
    }
  }

  return desde;
}

module.exports = { diasSolicitadosDesdeVersion, fechaHastaDesdeVersionPatronB };
