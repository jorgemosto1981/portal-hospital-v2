/**
 * Épica B — contrato motor: `presentacion_compuesto` y contexto de celda `vis_*`
 * derivados solo de la capa materializada (+ fichadas en celda para analítica).
 */

import { resolverPresentacionCompuestoCelda } from "./resolverPresentacionCompuestoCelda.js";

function normalizarTipoDia(tipo) {
  const t = String(tipo || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "no_laborable" || t === "no-laborable" || t === "nolaborable") return "no_laborable";
  if (t === "franco") return "franco";
  return t;
}

/**
 * @param {Record<string, unknown>|null|undefined} capaTeorica
 */
export function esDiaSinTurnoLaboralDesdeCapa(capaTeorica) {
  const tipo = normalizarTipoDia(capaTeorica?.tipo_dia);
  return tipo === "franco" || tipo === "no_laborable";
}

/**
 * No persistir `presentacion_compuesto` (evita `turno_compuesto_id` huérfano).
 * @param {Record<string, unknown>|null|undefined} capaTeorica
 */
export function debeOmitirPresentacionCompuestoMaterializada(capaTeorica) {
  if (!capaTeorica || typeof capaTeorica !== "object") return true;
  if (esDiaSinTurnoLaboralDesdeCapa(capaTeorica)) return true;
  const segs = Array.isArray(capaTeorica.segmentos) ? capaTeorica.segmentos : [];
  if (segs.length === 0) return true;
  return false;
}

/**
 * @param {Record<string, unknown>|null|undefined} capaTeorica
 */
export function pickRdaTurnoIdDesdeCapaMaterializada(capaTeorica) {
  if (esDiaSinTurnoLaboralDesdeCapa(capaTeorica)) return null;
  const tid = capaTeorica?.turno_id || capaTeorica?.turno_compuesto_id || null;
  return tid ? String(tid).trim() : null;
}

/**
 * @param {number|null|undefined} capaFichadas
 * @param {Record<string, unknown>|null|undefined} celdaRaw
 */
function fichadasEsperadasVis(capaFichadas, celdaRaw) {
  const n = Number(capaFichadas);
  if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  const cr = Number(celdaRaw?.fichadas_esperadas);
  if (Number.isFinite(cr) && cr >= 0) return Math.trunc(cr);
  return null;
}

/**
 * Contexto de celda para analítica/validación: la capa materializada manda sobre `vis` stale.
 *
 * @param {Record<string, unknown>} celdaRaw
 * @param {Record<string, unknown>} capaEnriquecida
 */
export function construirCeldaCtxTrasCapaMaterializada(celdaRaw, capaEnriquecida) {
  const raw = celdaRaw && typeof celdaRaw === "object" ? celdaRaw : {};
  const capa = capaEnriquecida && typeof capaEnriquecida === "object" ? capaEnriquecida : {};
  const sinTurnoLaboral = esDiaSinTurnoLaboralDesdeCapa(capa);

  const celdaCtx = {
    ...raw,
    tipo_dia: sinTurnoLaboral ? capa.tipo_dia : (raw.tipo_dia ?? capa.tipo_dia),
    es_franco: sinTurnoLaboral ? true : raw.es_franco,
    fichadas_esperadas: sinTurnoLaboral
      ? fichadasEsperadasVis(capa.fichadas_esperadas, raw)
      : (raw.fichadas_esperadas ?? capa.fichadas_esperadas),
    fichadas_reales: raw.fichadas_reales,
    rda_turno_id: sinTurnoLaboral
      ? null
      : (raw.rda_turno_id ?? pickRdaTurnoIdDesdeCapaMaterializada(capa)),
    rda_ingreso: sinTurnoLaboral ? null : raw.rda_ingreso,
    rda_egreso: sinTurnoLaboral ? null : raw.rda_egreso,
  };

  if (sinTurnoLaboral) {
    delete celdaCtx.presentacion_compuesto;
    delete celdaCtx.analitica_cumplimiento;
  }

  return celdaCtx;
}

/**
 * Única puerta motor para escribir `presentacion_compuesto` en `vis_*`.
 *
 * @param {Record<string, unknown>} celdaVis
 * @param {Record<string, unknown>} capaTeorica
 * @param {Record<string, unknown>|null} analitica
 * @param {{ fecha_ymd?: string, eval_fingerprint?: string }} [opts]
 * @returns {Record<string, unknown>|null}
 */
export function resolverPresentacionVisMaterializada(celdaVis, capaTeorica, analitica, opts = {}) {
  if (debeOmitirPresentacionCompuestoMaterializada(capaTeorica)) return null;
  return resolverPresentacionCompuestoCelda(celdaVis, capaTeorica, analitica, opts);
}
