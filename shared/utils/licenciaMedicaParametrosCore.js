/**
 * Parámetros globales — licencia médica Caja Negra (RFC §2.4, G3).
 * IDs = documentos en `cfg_parametros_sistema`.
 */

export const PARAM_LM_INCOMPLETA_PLAZO_HORAS = "param_lm_incompleta_plazo_horas";
export const PARAM_LM_INCOMPLETA_AVISO_OBLIGACION_HORAS =
  "param_lm_incompleta_aviso_obligacion_horas";

const MAX_HORAS_PARAM = 8760;

/**
 * @param {Record<string, unknown> | null | undefined} docData
 * @param {{ fallbackDevOnly?: number }} [opts] — fallback solo entorno dev/documentado en runbook
 */
export function resolverHorasDesdeParametroSistema(docData, opts = {}) {
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
 */
export function calcularVencimientoPlazoCertificado(anchor, horas) {
  if (!(anchor instanceof Date) || Number.isNaN(anchor.getTime())) {
    throw new Error("ANCHOR_FECHA_INVALIDA");
  }
  const h = Number(horas);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error("HORAS_PLAZO_INVALIDAS");
  }
  return new Date(anchor.getTime() + h * 3600 * 1000);
}
