/**
 * HLc operativo vigente a hoy (BA): vigencia inclusiva + activo + sin baja administrativa.
 */
import {
  hlcFechaDesdeYmd,
  hlcFechaHastaYmd,
  obtenerYmdHoyInstitucional,
  vigenteEnFechaInclusivaYmd,
} from "./fechaLaboralYmd.js";

/**
 * @param {unknown} row
 */
export function isHlcOperativo(row) {
  if (!row || typeof row !== "object") return false;
  if (row.activo === false) return false;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return false;
  const ref = obtenerYmdHoyInstitucional();
  return vigenteEnFechaInclusivaYmd(hlcFechaDesdeYmd(row), hlcFechaHastaYmd(row) || null, ref);
}
