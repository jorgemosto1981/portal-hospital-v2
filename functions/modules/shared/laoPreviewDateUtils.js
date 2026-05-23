"use strict";

/**
 * Utilidades de fecha para motor LAO (parse YMD, anclas UTC BA, intervalos cerrados).
 * Extraídas de laoPreviewMotor v1 — sin lógica de simulación.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { civilDateInZonaToUtcAnchorMs } = require("./fechaInstitucionalBa");

/**
 * @param {unknown} str
 * @returns {{ y: number, mo: number, d: number } | null}
 */
function parseYmd(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

/**
 * @param {string} ymd
 * @returns {number | null} ms UTC ancla del día civil BA
 */
function anchorFromYmd(ymd) {
  const p = parseYmd(ymd);
  if (!p) return null;
  try {
    return civilDateInZonaToUtcAnchorMs(p.y, p.mo, p.d);
  } catch {
    return null;
  }
}

/** @param {{ inicioUtc: number, finUtc: number }[]} intervals */
function mergeClosedIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.inicioUtc - b.inicioUtc);
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.inicioUtc <= last.finUtc + MS_PER_DAY) {
      if (cur.finUtc > last.finUtc) last.finUtc = cur.finUtc;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

module.exports = {
  MS_PER_DAY,
  parseYmd,
  anchorFromYmd,
  mergeClosedIntervals,
};
