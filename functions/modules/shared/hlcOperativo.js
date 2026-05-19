"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const {
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  obtenerYmdHoyInstitucional,
  vigenteEnFechaInclusivaYmd,
} = require("./fechaLaboralYmd");

/**
 * HLc operativo vigente a hoy (BA): vigencia inclusiva + activo + sin baja administrativa.
 */

/**
 * @param {unknown} row
 */
function isHlcOperativo(row) {
  if (!row || typeof row !== "object") return false;
  if (row.activo === false) return false;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return false;
  const ref = obtenerYmdHoyInstitucional();
  return vigenteEnFechaInclusivaYmd(hlcFechaDesdeYmd(row), hlcFechaHastaYmd(row) || null, ref);
}

module.exports = { isHlcOperativo };
