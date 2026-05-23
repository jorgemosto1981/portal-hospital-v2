"use strict";

/**
 * Intervalos HLC y TSE con huecos laborales (RFC R1).
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §7
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { civilDateInZonaToUtcAnchorMs, formatYmdEnZona } = require("./fechaInstitucionalBa");
const { mergeClosedIntervals, parseYmd, anchorFromYmd } = require("./laoPreviewDateUtils");

function ymdToAnchor(ymd) {
  const p = parseYmd(ymd);
  if (!p) return null;
  try {
    return civilDateInZonaToUtcAnchorMs(p.y, p.mo, p.d);
  } catch {
    return null;
  }
}

function isHlcRowActive(row) {
  if (!row || typeof row !== "object") return false;
  if (row.deshabilitado_en) return false;
  if (row.computa_antiguedad_licencias === false) return false;
  return true;
}

function rowInicioYmd(row) {
  const raw = row?.fecha_inicio ?? row?.fecha_desde ?? null;
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function rowFinYmd(row) {
  const raw = row?.fecha_fin ?? row?.fecha_hasta ?? null;
  if (raw == null) return null;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Tramos HLC recortados a ventana [windowStartYmd, windowEndYmd] (inclusive).
 * @returns {{ inicioUtc: number, finUtc: number, inicioYmd: string, finYmd: string }[]}
 */
function buildHlcCoverageIntervalsInWindow(hlcArray, windowStartYmd, windowEndYmd) {
  const tWin0 = ymdToAnchor(windowStartYmd);
  const tWin1 = ymdToAnchor(windowEndYmd);
  if (tWin0 == null || tWin1 == null || tWin1 < tWin0) return [];

  const raw = [];
  for (const row of Array.isArray(hlcArray) ? hlcArray : []) {
    if (!isHlcRowActive(row)) continue;
    const inicioYmd = rowInicioYmd(row);
    if (!inicioYmd) continue;
    const t0 = ymdToAnchor(inicioYmd);
    if (t0 == null) continue;
    const finExplicit = rowFinYmd(row);
    let t1 = finExplicit ? ymdToAnchor(finExplicit) : tWin1;
    if (t1 == null) t1 = tWin1;
    if (t1 < t0) continue;
    const clip0 = Math.max(t0, tWin0);
    const clip1 = Math.min(t1, tWin1);
    if (clip1 < clip0) continue;
    raw.push({
      inicioUtc: clip0,
      finUtc: clip1,
      inicioYmd: formatYmdEnZona(clip0),
      finYmd: formatYmdEnZona(clip1),
    });
  }

  const mergedUtc = mergeClosedIntervals(raw.map((r) => ({ inicioUtc: r.inicioUtc, finUtc: r.finUtc })));
  return mergedUtc.map((iv) => ({
    inicioUtc: iv.inicioUtc,
    finUtc: iv.finUtc,
    inicioYmd: formatYmdEnZona(iv.inicioUtc),
    finYmd: formatYmdEnZona(iv.finUtc),
  }));
}

function dayInMerged(t, merged) {
  for (const iv of merged) {
    if (t >= iv.inicioUtc && t <= iv.finUtc) return true;
  }
  return false;
}

function dayInExclusion(t, exclusionMerged) {
  for (const iv of exclusionMerged) {
    if (t >= iv.inicioUtc && t <= iv.finUtc) return true;
  }
  return false;
}

/**
 * Días TSE: cobertura HLC en [01/01/anioActual .. fechaHastaYmd] menos exclusiones licencias.
 */
function computeDiasTseServicioEfectivo({ hlcArray, anioActual, fechaHastaYmd, exclusionIntervals = [] }) {
  const anio = Number(anioActual);
  const pHasta = parseYmd(fechaHastaYmd);
  if (!Number.isInteger(anio) || !pHasta || pHasta.y !== anio) {
    throw new Error("fecha_hasta inválida o no coincide con anioActual.");
  }

  const windowStart = `${anio}-01-01`;
  const hlcMerged = buildHlcCoverageIntervalsInWindow(hlcArray, windowStart, fechaHastaYmd);
  const hlcUtc = hlcMerged.map((r) => ({ inicioUtc: r.inicioUtc, finUtc: r.finUtc }));

  const t0 = civilDateInZonaToUtcAnchorMs(anio, 1, 1);
  const t1 = anchorFromYmd(fechaHastaYmd);
  if (t1 == null || t1 < t0) {
    throw new Error("fecha_hasta anterior al 01/01 del año civil.");
  }

  const exclusionMerged = mergeClosedIntervals(Array.isArray(exclusionIntervals) ? exclusionIntervals : []);

  let diasTse = 0;
  const meses = new Set();
  for (let t = t0; t <= t1; t += MS_PER_DAY) {
    if (!dayInMerged(t, hlcUtc)) continue;
    if (dayInExclusion(t, exclusionMerged)) continue;
    diasTse += 1;
    meses.add(formatYmdEnZona(t).slice(0, 7));
  }

  return {
    diasTse,
    mesesConDiaEfectivo: meses.size,
    mesesKeys: [...meses].sort(),
    hlcMergedEnVentana: hlcMerged,
  };
}

/**
 * Meses calendario con al menos un día HLC en el ejercicio hasta 31/12 (proporcional).
 */
function computeMesesComputablesEjercicio(hlcArray, anioImputado) {
  const anio = Number(anioImputado);
  if (!Number.isInteger(anio)) return { meses: 0, mesesKeys: [] };
  const merged = buildHlcCoverageIntervalsInWindow(hlcArray, `${anio}-01-01`, `${anio}-12-31`);
  const meses = new Set();
  for (const iv of merged) {
    for (let t = iv.inicioUtc; t <= iv.finUtc; t += MS_PER_DAY) {
      meses.add(formatYmdEnZona(t).slice(0, 7));
    }
  }
  const keys = [...meses].sort();
  return { meses: keys.length, mesesKeys: keys };
}

module.exports = {
  buildHlcCoverageIntervalsInWindow,
  computeDiasTseServicioEfectivo,
  computeMesesComputablesEjercicio,
};
