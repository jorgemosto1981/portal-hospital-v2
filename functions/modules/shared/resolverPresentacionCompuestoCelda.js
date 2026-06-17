"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { capaMaterializadaConSegmentosMultiples } = require("./capaTeoricaLimitesCumplimiento");
const {
  badgesDisciplinaDesdeSegmentoAnalitica,
  disciplinaHorariaEsIncumplimientoPorMargen,
  extraerTramosFichadaDesdeCelda,
  segmentoTieneIncumplimientoDisciplina,
} = require("./calcularDeltasCumplimiento");
const { isoToHhmmInstitucional, rangoHhmmLabel } = require("./horarioInstitucionalDisplay");

/**
 * Presentación apilada por segmento (RFC filas celda) — derivada de analítica + fichadas.
 */




const PRESENTACION_VERSION = 1;

function msDesdeIso(iso) {
  const ms = new Date(String(iso || "")).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {number} ingreso_nominal_ms
 * @param {number} egreso_nominal_ms
 */
function recortePresenciaEnVentanaNominal(tramos, ingreso_nominal_ms, egreso_nominal_ms) {
  let ingreso_ms = null;
  let egreso_ms = null;
  for (const t of tramos) {
    const inicio = Math.max(t.ingreso_ms, ingreso_nominal_ms);
    const fin = Math.min(t.egreso_ms, egreso_nominal_ms);
    if (fin <= inicio) continue;
    if (ingreso_ms == null || inicio < ingreso_ms) ingreso_ms = inicio;
    if (egreso_ms == null || fin > egreso_ms) egreso_ms = fin;
  }
  if (ingreso_ms == null || egreso_ms == null) return null;
  return { ingreso_ms, egreso_ms };
}

/**
 * Presente / parcial / ausente por tramo (dimensión A — disciplina horaria del segmento).
 * No usa tolerancia de débito del régimen (dimensión B).
 *
 * @param {Record<string, unknown>} seg
 * @param {number} tolerancia_ingreso_min
 * @param {number} tolerancia_egreso_min
 * @returns {"presente"|"parcial"|"ausente"}
 */
function estadoTramoDesdeSegmentoAnalitica(seg, tolerancia_ingreso_min, tolerancia_egreso_min) {
  if (seg.cubierto !== true) return "ausente";
  if (segmentoTieneIncumplimientoDisciplina(seg)) return "parcial";
  const punt = disciplinaHorariaEsIncumplimientoPorMargen(
    seg.tardanza_minutos,
    seg.salida_anticipada_minutos,
    tolerancia_ingreso_min,
    tolerancia_egreso_min,
  );
  if (punt.hay_incumplimiento) return "parcial";
  return "presente";
}

/**
 * @param {Record<string, unknown>} seg
 */
function badgesDesdeSegmentoAnalitica(seg) {
  const badges = badgesDisciplinaDesdeSegmentoAnalitica(seg);
  if (!badges.length) {
    return { badges: [], badge_label: null, badge_tipo: null };
  }
  return {
    badges,
    badge_label: badges[0].label,
    badge_tipo: badges[0].tipo,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Record<string, unknown>|null|undefined} capaTeorica
 * @param {Record<string, unknown>|null|undefined} analitica
 * @param {{ fecha_ymd?: string, eval_fingerprint?: string }} [opts]
 * @returns {Record<string, unknown>|null}
 */
function resolverPresentacionCompuestoCelda(celdaVis, capaTeorica, analitica, opts = {}) {
  const capa = capaTeorica && typeof capaTeorica === "object" ? capaTeorica : {};
  if (!capaMaterializadaConSegmentosMultiples(capa)) return null;

  const anal = analitica && typeof analitica === "object" ? analitica : {};
  if (anal.calculo_por_segmentos !== true) return null;

  const segsCapa = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (segsCapa.length < 2) return null;

  const segsAnal = Array.isArray(anal.segmentos_cumplimiento) ? anal.segmentos_cumplimiento : [];
  const tolIn = Number(capa.tolerancia_ingreso_dia_min) || 0;
  const tolOut = Number(capa.tolerancia_egreso_dia_min) || 0;
  const fechaYmd = String(opts.fecha_ymd || capa.fecha_base || "").slice(0, 10);
  const { tramos } = extraerTramosFichadaDesdeCelda(celdaVis, fechaYmd);

  const filas = segsCapa.map((segCapa, orden) => {
    const segmento_id = String(segCapa?.segmento_id || "").trim();
    const segAnal =
      segsAnal.find((s) => String(s?.segmento_id || "").trim() === segmento_id)
      || segsAnal[orden]
      || {};

    const ingreso_nominal_ms = msDesdeIso(segCapa.ingreso_iso);
    const egreso_nominal_ms = msDesdeIso(segCapa.egreso_iso);
    const teoria_label = rangoHhmmLabel(
      isoToHhmmInstitucional(segCapa.ingreso_iso),
      isoToHhmmInstitucional(segCapa.egreso_iso),
    );

    const estado_tramo = estadoTramoDesdeSegmentoAnalitica(segAnal, tolIn, tolOut);
    /** @type {string|null} */
    let fichada_label = null;
    if (estado_tramo !== "ausente" && ingreso_nominal_ms != null && egreso_nominal_ms != null) {
      const recorte = recortePresenciaEnVentanaNominal(
        tramos,
        ingreso_nominal_ms,
        egreso_nominal_ms,
      );
      if (recorte) {
        fichada_label =
          rangoHhmmLabel(
            isoToHhmmInstitucional(new Date(recorte.ingreso_ms).toISOString()),
            isoToHhmmInstitucional(new Date(recorte.egreso_ms).toISOString()),
          ) || null;
      }
    }

    const { badge_label, badge_tipo, badges } = badgesDesdeSegmentoAnalitica(segAnal);

    return {
      segmento_id,
      orden,
      teoria_label,
      fichada_label,
      estado_tramo,
      badge_label,
      badge_tipo,
      badges,
      cobertura_minutos: Math.trunc(Number(segAnal.cobertura_minutos) || 0),
      carga_teorica_minutos: Math.trunc(Number(segAnal.carga_teorica_minutos) || 0),
    };
  });

  const out = {
    version: PRESENTACION_VERSION,
    turno_compuesto_id: String(capa.turno_compuesto_id || capa.turno_id || "").trim() || null,
    filas,
  };
  if (opts.eval_fingerprint) {
    out.eval_fingerprint = String(opts.eval_fingerprint);
  }
  return out;
}

module.exports = { resolverPresentacionCompuestoCelda };
