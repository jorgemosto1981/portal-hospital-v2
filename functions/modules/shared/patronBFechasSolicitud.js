"use strict";

/**
 * Días y fecha_hasta Patrón B para listado / preview (sin persistir).
 * El motor de alta MVP exige fecha_hasta === fecha_desde cuando el evento es 1 día.
 */

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @returns {number}
 */
function diasSolicitadosDesdeVersion(versionData) {
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
 * @returns {string}
 */
function fechaHastaDesdeVersionPatronB(fechaDesdeYmd, diasSolicitados) {
  const dias = Number.isFinite(diasSolicitados) && diasSolicitados > 0 ? Math.floor(diasSolicitados) : 1;
  if (dias <= 1) return String(fechaDesdeYmd || "").slice(0, 10);
  // Multi-día hábil: Fase 2.3+ (motor hoy solo 1 día calendario).
  return String(fechaDesdeYmd || "").slice(0, 10);
}

module.exports = { diasSolicitadosDesdeVersion, fechaHastaDesdeVersionPatronB };
