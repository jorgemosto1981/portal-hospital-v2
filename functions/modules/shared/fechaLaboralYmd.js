"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { formatYmdEnZona, obtenerYmdHoyInstitucional } = require("./fechaInstitucionalBa");

/**
 * Fechas civiles YYYY-MM-DD para HLc / HLd / HLg (zona institucional BA).
 * Vigencia de períodos: [desde, hasta] inclusive.
 */

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @returns {string} `YYYY-MM-DD` o `""`
 */
function ymdDesdeValorLaboral(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object" && value !== null && typeof value.toDate === "function") {
    try {
      return formatYmdEnZona(value.toDate().getTime());
    } catch {
      return "";
    }
  }
  const raw = String(value).trim();
  if (!raw) return "";
  if (RX_YMD.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return formatYmdEnZona(d.getTime());
}

/**
 * @param {string} desdeYmd
 * @param {string | null | undefined} hastaYmd vacío = abierto
 * @param {string} fechaRefYmd
 */
function vigenteEnFechaInclusivaYmd(desdeYmd, hastaYmd, fechaRefYmd) {
  const desde = ymdDesdeValorLaboral(desdeYmd);
  const hasta = hastaYmd ? ymdDesdeValorLaboral(hastaYmd) : "";
  const ref = ymdDesdeValorLaboral(fechaRefYmd);
  if (!desde || !ref) return false;
  if (desde > ref) return false;
  if (hasta && hasta < ref) return false;
  return true;
}

/** @param {Record<string, unknown> | null | undefined} row */
function hlcFechaDesdeYmd(row) {
  if (!row || typeof row !== "object") return "";
  return ymdDesdeValorLaboral(row.fecha_desde ?? row.fecha_inicio ?? row.vigente_desde);
}

/** @param {Record<string, unknown> | null | undefined} row */
function hlcFechaHastaYmd(row) {
  if (!row || typeof row !== "object") return "";
  return ymdDesdeValorLaboral(row.fecha_hasta ?? row.fecha_fin ?? row.vigente_hasta);
}

/** @param {Record<string, unknown> | null | undefined} row */
function hldHlgFechaInicioYmd(row) {
  if (!row || typeof row !== "object") return "";
  return ymdDesdeValorLaboral(row.fecha_inicio ?? row.fecha_desde);
}

/** @param {Record<string, unknown> | null | undefined} row */
function hldHlgFechaFinYmd(row) {
  if (!row || typeof row !== "object") return "";
  return ymdDesdeValorLaboral(row.fecha_fin ?? row.fecha_hasta);
}

module.exports = { obtenerYmdHoyInstitucional, ymdDesdeValorLaboral, vigenteEnFechaInclusivaYmd, hlcFechaDesdeYmd, hlcFechaHastaYmd, hldHlgFechaInicioYmd, hldHlgFechaFinYmd };
