"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { envelopeTeoricoDesdeCapa } = require("./capaTeoricaLimitesCumplimiento");

/**
 * Lectura de celdas vis_* fusionando claves planas legacy `dias.18.campo`.
 * @param {Record<string, unknown>} data
 */
function fusionarDiasDesdeClavesPlanas(data) {
  const dias = data.dias && typeof data.dias === "object" ? { ...data.dias } : {};
  for (const [key, value] of Object.entries(data)) {
    const m = key.match(/^dias\.(\d+)\.(.+)$/);
    if (!m) continue;
    const dk = m[1];
    const field = m[2];
    if (!dias[dk] || typeof dias[dk] !== "object") dias[dk] = {};
    const nestedCelda = data.dias?.[dk];
    if (
      nestedCelda
      && typeof nestedCelda === "object"
      && Object.prototype.hasOwnProperty.call(nestedCelda, field)
      && (field === "analitica_cumplimiento" || field === "validacion_fichada_dia")
    ) {
      continue;
    }
    // Las actualizaciones por dot-path (`dias.14.campo` en la raíz del doc) son la fuente vigente.
    dias[dk][field] = value;
  }
  return dias;
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} diaKey
 */
function leerCeldaVisDiaFusionada(data, diaKey) {
  const dk = String(diaKey || "").trim();
  if (!dk || !data || typeof data !== "object") return {};
  const dias = fusionarDiasDesdeClavesPlanas(data);
  const celda = dias[dk];
  return celda && typeof celda === "object" ? celda : {};
}

/**
 * Sub-objeto materializado `presentacion_compuesto` (RFC filas celda).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {{ version?: number|null, turno_compuesto_id?: string|null, filas: Array<Record<string, unknown>> }|null}
 */
function leerPresentacionCompuestoDesdeCelda(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return null;
  const raw = celdaVis.presentacion_compuesto;
  if (!raw || typeof raw !== "object") return null;
  const filas = Array.isArray(raw.filas)
    ? raw.filas.filter((f) => f && typeof f === "object")
    : [];
  if (!filas.length) return null;
  return {
    version: raw.version ?? null,
    turno_compuesto_id: raw.turno_compuesto_id ?? null,
    filas,
  };
}

/**
 * Filas listas para iterar en UI (array vacío si no hay matriz compuesta).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {Array<Record<string, unknown>>}
 */
function filasPresentacionCompuestoDesdeCelda(celdaVis) {
  return leerPresentacionCompuestoDesdeCelda(celdaVis)?.filas ?? [];
}

/**
 * Tramos que el teórico de la celda exige hoy (`rda_turno_id` / presentación).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {Set<string>|null}
 */
function idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return null;
  const pres = leerPresentacionCompuestoDesdeCelda(celdaVis);
  const tid = String(celdaVis.rda_turno_id || pres?.turno_compuesto_id || "").trim();
  if (!tid) return null;
  if (!tid.includes("+")) {
    const one = /^[MTN]$/i.test(tid) ? tid.toUpperCase() : tid;
    return new Set([one]);
  }
  return new Set(tid.split("+").map((s) => s.trim()).filter(Boolean));
}

/**
 * Quita filas de tramos ya no teóricos (p. ej. T tras traslado origen 06→05).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Array<Record<string, unknown>>} filas
 */
function filtrarFilasPresentacionAlTeoricoOperativo(celdaVis, filas) {
  if (!Array.isArray(filas) || !filas.length) return filas;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return filas;
  const filtered = filas.filter((f) => ids.has(String(f?.segmento_id || "").trim()));
  return filtered.length ? filtered : filas;
}

/**
 * Alinea `capa.segmentos` al turno operativo de la celda (`rda_turno_id` / presentación).
 * Evita analítica y presentación con tramos obsoletos tras traslado origen (p. ej. T en día solo-M).
 *
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Record<string, unknown>|null|undefined} capa
 */
function alinearCapaSegmentosAlTeoricoVis(celdaVis, capa) {
  if (!capa || typeof capa !== "object") return capa;
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (segmentos.length < 2) return capa;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return capa;
  const filtered = segmentos.filter((s) => ids.has(String(s?.segmento_id || "").trim()));
  if (!filtered.length || filtered.length === segmentos.length) return capa;

  const rda = String(celdaVis?.rda_turno_id || "").trim();
  const turno_compuesto_id = rda
    || (filtered.length > 1
      ? filtered.map((s) => String(s?.segmento_id || "").trim()).filter(Boolean).join("+")
      : String(filtered[0]?.segmento_id || "").trim())
    || capa.turno_compuesto_id;

  const next = {
    ...capa,
    segmentos: filtered,
    turno_compuesto_id,
    ...(filtered.length === 1 ? { turno_id: filtered[0].segmento_id } : {}),
  };
  const env = envelopeTeoricoDesdeCapa(next);
  if (env.ingreso_teorico_final) {
    next.ingreso_teorico_final = env.ingreso_teorico_final;
    next.egreso_teorico_final = env.egreso_teorico_final;
  }
  if (env.horas_desde_segmentos != null) {
    next.horas_teoricas_totales = env.horas_desde_segmentos;
  }
  return next;
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Array<Record<string, unknown>>|undefined} segmentos
 */
function filtrarSegmentosCumplimientoAlTeoricoVis(celdaVis, segmentos) {
  if (!Array.isArray(segmentos) || !segmentos.length) return segmentos;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return segmentos;
  const filtered = segmentos.filter((s) => ids.has(String(s?.segmento_id || "").trim()));
  return filtered.length ? filtered : segmentos;
}

module.exports = { fusionarDiasDesdeClavesPlanas, leerCeldaVisDiaFusionada, leerPresentacionCompuestoDesdeCelda, filasPresentacionCompuestoDesdeCelda, idsSegmentoTeoricoOperativoDesdeCeldaVis, filtrarFilasPresentacionAlTeoricoOperativo, alinearCapaSegmentosAlTeoricoVis, filtrarSegmentosCumplimientoAlTeoricoVis };
