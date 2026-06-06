"use strict";

const { FieldValue } = require("firebase-admin/firestore");

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @param {number} max
 */
function trimMetaStr(value, max = 80) {
  const t = String(value || "").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * Campos `metadata` para merge/set en `vis_*` tras materializar capa teórica.
 *
 * @param {{
 *   motivo?: string,
 *   rangoDesde?: string,
 *   rangoHasta?: string,
 *   origenEventoId?: string | null,
 * }} [opts]
 */
function buildVisMetadataMaterializacionFields(opts = {}) {
  const fields = {
    ultima_sync_teorica: FieldValue.serverTimestamp(),
    version_token: FieldValue.serverTimestamp(),
  };
  const motivo = trimMetaStr(opts.motivo, 64);
  if (motivo) {
    fields.ultimo_motivo = motivo;
    fields.ultimo_motivo_en = FieldValue.serverTimestamp();
  }
  const desde = String(opts.rangoDesde || "").slice(0, 10);
  const hasta = String(opts.rangoHasta || desde).slice(0, 10);
  if (RX_YMD.test(desde)) {
    fields.ultimo_rango_materializado = {
      desde,
      hasta: RX_YMD.test(hasta) ? hasta : desde,
    };
  }
  const origen = trimMetaStr(opts.origenEventoId, 80);
  if (origen) fields.ultimo_origen_evento_id = origen;
  return fields;
}

/**
 * Mismo contenido con claves `metadata.*` para `update()` con dot notation.
 *
 * @param {Parameters<typeof buildVisMetadataMaterializacionFields>[0]} opts
 */
function patchVisMetadataMaterializacionDot(opts = {}) {
  const nested = buildVisMetadataMaterializacionFields(opts);
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const [key, value] of Object.entries(nested)) {
    patch[`metadata.${key}`] = value;
  }
  return patch;
}

module.exports = {
  buildVisMetadataMaterializacionFields,
  patchVisMetadataMaterializacionDot,
};
