"use strict";

const { calcularDeltasCumplimiento } = require("./calcularDeltasCumplimiento");
const {
  construirCeldaCtxTrasCapaMaterializada,
  resolverPresentacionVisMaterializada,
} = require("./materializarPresentacionVisCelda");
const { resolverValidacionFichadaDia } = require("./resolverValidacionFichadaDia");
const { obtenerYmdHoyInstitucional } = require("./fechaInstitucionalBa.js");
const { FieldValue, FieldPath } = require("firebase-admin/firestore");

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
 * Escribe analítica + validación en vis_* (mapa `dias`), purgando claves planas legacy en la raíz.
 *
 * @param {import("firebase-admin/firestore").DocumentReference} visRef
 * @param {string} diaKey
 * @param {Record<string, unknown>|null} analitica
 * @param {{ accion?: string, validacion_fichada_dia?: object }|null|undefined} resolverOut
 */
async function aplicarAnaliticaValidacionVisDia(visRef, diaKey, analitica, resolverOut, presentacionCompuesto) {
  const dk = String(diaKey || "").trim();
  if (!visRef || !dk) return;

  const visPayload = { [`dias.${dk}.analitica_cumplimiento`]: analitica };
  const presPath = `dias.${dk}.presentacion_compuesto`;
  if (presentacionCompuesto && typeof presentacionCompuesto === "object") {
    visPayload[presPath] = presentacionCompuesto;
  } else {
    visPayload[presPath] = FieldValue.delete();
  }
  const valPatch = buildFirestorePatchValidacionFichadaDia(dk, resolverOut);
  if (valPatch) Object.assign(visPayload, valPatch);

  const visSnap = await visRef.get();
  const visData = visSnap.exists ? visSnap.data() || {} : {};
  const prefixPlano = `dias.${dk}.`;
  /** @type {Array<unknown>} */
  const purgaArgs = [];
  for (const key of Object.keys(visData)) {
    if (!key.startsWith(prefixPlano)) continue;
    purgaArgs.push(new FieldPath(key), FieldValue.delete());
  }
  if (purgaArgs.length > 0) {
    await visRef.update(...purgaArgs);
  }

  const analiticaPath = `dias.${dk}.analitica_cumplimiento`;
  if (visSnap.exists) {
    await visRef.update({ [analiticaPath]: FieldValue.delete() });
    await visRef.update(visPayload);
  } else {
    await visRef.set(visPayload, { merge: true });
  }
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
  const hoy = obtenerYmdHoyInstitucional(ahoraMs);
  if (fecha_ymd > hoy) {
    return {
      analitica: null,
      resolverOut: { accion: "omit", motivo: "dia_futuro" },
    };
  }
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

  const presentacion_compuesto = resolverPresentacionVisMaterializada(
    celdaCtx,
    capaEnriquecida,
    analitica,
    { fecha_ymd },
  );

  return { analitica, resolverOut, presentacion_compuesto };
}

module.exports = {
  dotPathValidacionFichadaDia,
  buildFirestorePatchValidacionFichadaDia,
  ejecutarAnaliticaYValidacionFichadaDia,
  aplicarAnaliticaValidacionVisDia,
};
