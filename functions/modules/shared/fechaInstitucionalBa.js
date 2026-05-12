"use strict";

/** @see ../../../../shared/utils/fechaInstitucionalBa.js — mantener alineado (Functions empaquetan CJS). */

const ZONA_HORARIA_INSTITUCIONAL = "America/Argentina/Buenos_Aires";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYmdEnZona(ms, timeZone = ZONA_HORARIA_INSTITUCIONAL) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function ymdEnZonaDesdeInstante(ms, timeZone = ZONA_HORARIA_INSTITUCIONAL) {
  const s = formatYmdEnZona(ms, timeZone);
  const [y, m, d] = s.split("-").map(Number);
  return { year: y, month: m, day: d };
}

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

function obtenerYmdHoyInstitucional(nowMs = Date.now()) {
  return formatYmdEnZona(nowMs);
}

module.exports = {
  ZONA_HORARIA_INSTITUCIONAL,
  formatYmdEnZona,
  ymdEnZonaDesdeInstante,
  civilDateInZonaToUtcAnchorMs,
  obtenerYmdHoyInstitucional,
};
