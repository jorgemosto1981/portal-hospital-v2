"use strict";

const { calcularDeltasCumplimiento } = require("./calcularDeltasCumplimiento");
const { resolverValidacionFichadaDia } = require("./resolverValidacionFichadaDia");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * @param {string} diaKey
 */
function dotPathValidacionFichadaDia(diaKey) {
  return `dias.${String(diaKey || "").trim()}.validacion_fichada_dia`;
}

/**
 * @param {string} diaKey
 * @param {{ accion?: string, validacion_fichada_dia?: object }|null|undefined} resolverResult
 * @returns {Record<string, unknown>|null}
 */
function buildFirestorePatchValidacionFichadaDia(diaKey, resolverResult) {
  if (!resolverResult || typeof resolverResult !== "object") return null;
  const path = dotPathValidacionFichadaDia(diaKey);
  const accion = String(resolverResult.accion || "");
  if (accion === "omit" || accion === "skip") return null;
  if (accion === "delete") {
    return { [path]: FieldValue.delete() };
  }
  if (accion === "write" && resolverResult.validacion_fichada_dia) {
    return { [path]: resolverResult.validacion_fichada_dia };
  }
  return null;
}

/**
 * @param {object} params
 * @param {Record<string, unknown>} params.celdaCtx
 * @param {Record<string, unknown>} [params.celdaRaw]
 * @param {Record<string, unknown>} params.capaEnriquecida
 * @param {string} params.fecha_ymd
 * @param {number} [params.ahora_evaluacion_ms]
 * @param {boolean} [params.forzar_recalculo]
 */
function ejecutarAnaliticaYValidacionFichadaDia(params) {
  const fecha_ymd = String(params.fecha_ymd || "").slice(0, 10);
  const ahoraMs = Number.isFinite(Number(params.ahora_evaluacion_ms))
    ? Number(params.ahora_evaluacion_ms)
    : Date.now();
  const celdaCtx = params.celdaCtx && typeof params.celdaCtx === "object" ? params.celdaCtx : {};
  const celdaRaw = params.celdaRaw && typeof params.celdaRaw === "object" ? params.celdaRaw : celdaCtx;
  const capaEnriquecida = params.capaEnriquecida && typeof params.capaEnriquecida === "object"
    ? params.capaEnriquecida
    : {};

  const analitica = calcularDeltasCumplimiento(celdaCtx, capaEnriquecida, {
    fecha_ymd,
    ahora_evaluacion_ms: ahoraMs,
  });

  const resolverOut = resolverValidacionFichadaDia({
    celda: celdaCtx,
    capaTeoricaGrupo: capaEnriquecida,
    eventos: celdaRaw.eventos,
    fecha_ymd,
    ahora_evaluacion_ms: ahoraMs,
    analitica_existente: analitica,
    validacion_existente: celdaRaw.validacion_fichada_dia,
    forzar_recalculo: params.forzar_recalculo === true,
  });

  return { analitica, resolverOut };
}

module.exports = {
  dotPathValidacionFichadaDia,
  buildFirestorePatchValidacionFichadaDia,
  ejecutarAnaliticaYValidacionFichadaDia,
};
