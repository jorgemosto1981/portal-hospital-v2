import {
  hldHlgFechaFinYmd,
  hldHlgFechaInicioYmd,
  vigenteEnFechaInclusivaYmd,
} from "../../pages/datos-laborales/utils.js";

/**
 * Paridad con `hlgVigenteOperativaEnGrilla` (backend): grilla / capa teórica.
 * HLg deshabilitada: `fecha_fin` = primer día sin incorporación (corte exclusivo).
 * @param {Record<string, unknown>} hlg
 * @param {string} fechaRefYmd
 */
export function hlgVigenteEnDia(hlg, fechaRefYmd) {
  if (!hlg || typeof hlg !== "object") return false;
  const fecha = String(fechaRefYmd || "").slice(0, 10);
  const desde = hldHlgFechaInicioYmd(hlg);
  const finYmd = hldHlgFechaFinYmd(hlg);
  if (!desde || !fecha || desde > fecha) return false;
  if (hlg.activo !== false) {
    return vigenteEnFechaInclusivaYmd(desde, finYmd || null, fecha);
  }
  if (!finYmd) return false;
  return fecha < finYmd;
}

/**
 * @param {Array<Record<string, unknown>>} hlgRows
 * @param {string} grupoTrabajoId
 * @param {string} fechaYmd
 */
export function titularDiaAsignadoAGrupo(hlgRows, grupoTrabajoId, fechaYmd) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return true;
  const rows = Array.isArray(hlgRows) ? hlgRows : [];
  return rows.some((h) => {
    const gdtRow = String(h.grupo_de_trabajo_id || h.grupo_trabajo_id || "").trim();
    return gdtRow === gdt && hlgVigenteEnDia(h, fechaYmd);
  });
}
