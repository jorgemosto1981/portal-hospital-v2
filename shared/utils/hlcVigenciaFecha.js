/**
 * Vigencia de HLC en una fecha civil (BA). Complementa isHlcOperativo (solo “ahora”).
 */
import { civilDateInZonaToUtcAnchorMs, ymdEnZonaDesdeInstante } from "./fechaInstitucionalBa.js";

/**
 * @param {string | null | undefined} ymd
 */
export function parseYmdFromString(ymd) {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/**
 * @param {unknown} row
 */
export function isHlcDeshabilitada(row) {
  if (!row || typeof row !== "object") return true;
  if (row.deshabilitado_en != null) return true;
  if (String(row.motivo_deshabilitacion_id || "").trim()) return true;
  return false;
}

/**
 * @param {string | null | undefined} raw
 * @returns {number | null} UTC anchor ms
 */
export function hlcFechaToAnchor(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    try {
      const { year, month, day } = ymdEnZonaDesdeInstante(raw.toDate().getTime());
      return civilDateInZonaToUtcAnchorMs(year, month, day);
    } catch {
      return null;
    }
  }
  const ymd = parseYmdFromString(String(raw).trim());
  if (!ymd) return null;
  return civilDateInZonaToUtcAnchorMs(ymd.year, ymd.month, ymd.day);
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} fechaYmd YYYY-MM-DD
 */
export function isHlcVigenteEnFecha(row, fechaYmd) {
  if (!row || typeof row !== "object") return false;
  if (isHlcDeshabilitada(row)) return false;

  const corte = parseYmdFromString(fechaYmd);
  if (!corte) return false;
  const tCorte = civilDateInZonaToUtcAnchorMs(corte.year, corte.month, corte.day);

  const inicio = hlcFechaToAnchor(row.fecha_inicio ?? row.fecha_desde ?? row.vigente_desde);
  if (inicio == null || inicio > tCorte) return false;

  const fin = hlcFechaToAnchor(row.fecha_fin ?? row.fecha_hasta ?? row.vigente_hasta);
  if (fin != null && fin < tCorte) return false;

  return true;
}
