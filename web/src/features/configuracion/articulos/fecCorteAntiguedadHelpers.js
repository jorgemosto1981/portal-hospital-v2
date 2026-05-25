/**
 * Fecha de corte de antigüedad LAO: en Firestore es ISO, pero el negocio solo usa día/mes.
 * Año de referencia fijo (bisiesto) para serializar sin ambigüedad (Feb 29).
 * Contrato: docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md (§7).
 */
export const FEC_CORTE_ANTIGUEDAD_REF_YEAR = 2000;

/** @param {number} month 1–12 (asume año de referencia bisiesto) */
export function daysInMonthForFechaCorte(month) {
  const m = month;
  if (m === 2) return 29;
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
  return 31;
}

/**
 * @param {string | null | undefined} value ISO date o prefijo YYYY-MM-DD
 * @returns {{ month: number, day: number } | null}
 */
export function parseFechaCorteMonthDayFromIso(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const datePart = s.includes("T") ? s.slice(0, 10) : s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const maxD = daysInMonthForFechaCorte(month);
  if (day > maxD) return null;
  const dt = new Date(Date.UTC(FEC_CORTE_ANTIGUEDAD_REF_YEAR, month - 1, day));
  if (dt.getUTCFullYear() !== FEC_CORTE_ANTIGUEDAD_REF_YEAR || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return { month, day };
}

/**
 * @param {number} month 1–12
 * @param {number} day 1–31
 */
export function formatFechaCorteIsoRefYear(month, day) {
  return `${FEC_CORTE_ANTIGUEDAD_REF_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Devuelve ISO canónica año-ref si el string es una fecha válida; si no parsea, `null`.
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeFechaCorteAntiguedadIso(raw) {
  const p = parseFechaCorteMonthDayFromIso(raw);
  if (!p) return null;
  return formatFechaCorteIsoRefYear(p.month, p.day);
}
