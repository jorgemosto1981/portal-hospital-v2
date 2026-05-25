"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Fecha civil y anclajes para cálculos de antigüedad / LAO alineados a la operación en Argentina.
 * Zona IANA fija (no usar TZ del proceso ni getUTC* sobre instantes para “día de calendario”).
 */

const ZONA_HORARIA_INSTITUCIONAL = "America/Argentina/Buenos_Aires";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * @param {number} ms
 * @param {string} [timeZone]
 * @returns {string} `YYYY-MM-DD` del calendario civil en la zona
 */
function formatYmdEnZona(ms, timeZone = ZONA_HORARIA_INSTITUCIONAL) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/**
 * @param {number} ms
 * @param {string} [timeZone]
 * @returns {{ year: number, month: number, day: number }}
 */
function ymdEnZonaDesdeInstante(ms, timeZone = ZONA_HORARIA_INSTITUCIONAL) {
  const s = formatYmdEnZona(ms, timeZone);
  const [y, m, d] = s.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/**
 * UTC ms del inicio civil del día `year-month-day` en la zona (medianoche local).
 * Argentina (ART) está en UTC−3 sin horario de verano desde 2009: anclaje vía `Date.UTC(..., 3, 0, 0)`.
 * Se valida contra `Intl` para detectar cambios futuros de offset u otras zonas.
 *
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day 1–31
 * @param {string} [timeZone]
 */
function civilDateInZonaToUtcAnchorMs(year, month, day, timeZone = ZONA_HORARIA_INSTITUCIONAL) {
  const target = `${year}-${pad2(month)}-${pad2(day)}`;
  const t = Date.UTC(year, month - 1, day, 3, 0, 0, 0);
  if (formatYmdEnZona(t, timeZone) !== target) {
    throw new Error(
      `Anclaje civil TZ: ${target} no coincide con medianoche en ${timeZone}. Revisar offset o usar otro anclaje.`,
    );
  }
  return t;
}

/**
 * Hoy (reloj del sistema) como fecha civil en la zona institucional.
 * @param {number} [nowMs]
 */
function obtenerYmdHoyInstitucional(nowMs = Date.now()) {
  return formatYmdEnZona(nowMs);
}

module.exports = { ZONA_HORARIA_INSTITUCIONAL, formatYmdEnZona, ymdEnZonaDesdeInstante, civilDateInZonaToUtcAnchorMs, obtenerYmdHoyInstitucional };
