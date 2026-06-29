"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const {
  civilDateInZonaToUtcAnchorMs,
  formatYmdEnZona,
  ZONA_HORARIA_INSTITUCIONAL,
} = require("./fechaInstitucionalBa");

/**
 * Parámetros globales — licencia médica Caja Negra (RFC §2.4, G3).
 * IDs = documentos en `cfg_parametros_sistema`.
 */


const PARAM_LM_INCOMPLETA_PLAZO_HORAS = "param_lm_incompleta_plazo_horas";
const PARAM_LM_INCOMPLETA_AVISO_OBLIGACION_HORAS =
  "param_lm_incompleta_aviso_obligacion_horas";

const MAX_HORAS_PARAM = 8760;

/**
 * @param {Record<string, unknown> | null | undefined} docData
 * @param {{ fallbackDevOnly?: number }} [opts] — fallback solo entorno dev/documentado en runbook
 */
function resolverHorasDesdeParametroSistema(docData, opts = {}) {
  const n = Number(docData?.valor_numerico);
  if (Number.isFinite(n) && n > 0 && n <= MAX_HORAS_PARAM) {
    return Math.floor(n);
  }
  const fb = opts.fallbackDevOnly;
  if (fb != null && Number.isFinite(fb) && fb > 0) {
    return Math.floor(fb);
  }
  throw new Error("PARAMETRO_SISTEMA_LM_HORAS_INVALIDO");
}

/**
 * @param {Date} anchor
 * @param {number} horas
 * @returns {Date}
 * @deprecated Preferir {@link calcularVencimientoPlazoCertificadoDesdeInicioLicencia} (ancla = fecha inicio licencia).
 */
function calcularVencimientoPlazoCertificado(anchor, horas) {
  if (!(anchor instanceof Date) || Number.isNaN(anchor.getTime())) {
    throw new Error("ANCHOR_FECHA_INVALIDA");
  }
  const h = Number(horas);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error("HORAS_PLAZO_INVALIDAS");
  }
  return new Date(anchor.getTime() + h * 3600 * 1000);
}

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Días calendario de plazo a partir del parámetro en horas (24 h → 1 día completo adicional).
 * @param {number} horas
 */
function diasCalendarioPlazoDesdeHorasParametro(horas) {
  const h = Number(horas);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error("HORAS_PLAZO_INVALIDAS");
  }
  return Math.max(1, Math.ceil(h / 24));
}

/**
 * @param {string} ymd
 * @param {number} dias
 * @returns {string}
 */
function sumarDiasCalendarioYmd(ymd, dias) {
  if (!RX_YMD.test(String(ymd || ""))) {
    throw new Error("FECHA_INICIO_YMD_INVALIDA");
  }
  const n = Math.max(0, Math.floor(Number(dias)));
  const [y, m, d] = String(ymd).split("-").map(Number);
  let anchor = civilDateInZonaToUtcAnchorMs(y, m, d, ZONA_HORARIA_INSTITUCIONAL);
  anchor += n * 24 * 60 * 60 * 1000;
  return formatYmdEnZona(anchor, ZONA_HORARIA_INSTITUCIONAL);
}

/**
 * Vencimiento del plazo provisorio: desde la fecha de inicio de la licencia,
 * al cierre del día calendario (23:59:59.999 BA) tras `ceil(horas/24)` días completos.
 *
 * @param {string} fechaInicioYmd `YYYY-MM-DD`
 * @param {number} horas parámetro `param_lm_incompleta_plazo_horas`
 * @returns {Date}
 */
function calcularVencimientoPlazoCertificadoDesdeInicioLicencia(fechaInicioYmd, horas) {
  const dias = diasCalendarioPlazoDesdeHorasParametro(horas);
  const ymdFin = sumarDiasCalendarioYmd(fechaInicioYmd, dias);
  const [y, m, d] = ymdFin.split("-").map(Number);
  const inicioDiaSiguiente = civilDateInZonaToUtcAnchorMs(y, m, d, ZONA_HORARIA_INSTITUCIONAL) + 24 * 60 * 60 * 1000;
  return new Date(inicioDiaSiguiente - 1);
}

module.exports = { PARAM_LM_INCOMPLETA_PLAZO_HORAS, PARAM_LM_INCOMPLETA_AVISO_OBLIGACION_HORAS, resolverHorasDesdeParametroSistema, calcularVencimientoPlazoCertificado, diasCalendarioPlazoDesdeHorasParametro, sumarDiasCalendarioYmd, calcularVencimientoPlazoCertificadoDesdeInicioLicencia };
