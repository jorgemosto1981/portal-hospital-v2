/**
 * Presentación apilada por segmento (RFC filas celda) — derivada de analítica + fichadas.
 */

import { capaMaterializadaConSegmentosMultiples } from "./capaTeoricaLimitesCumplimiento.js";
import {
  extraerTramosFichadaDesdeCelda,
} from "./calcularDeltasCumplimiento.js";
import { isoToHhmmInstitucional, rangoHhmmLabel } from "./horarioInstitucionalDisplay.js";

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

function formatearMinutosJornada(minutos) {
  const m = Math.trunc(Number(minutos) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}h ${r}m`;
  if (h > 0) return `${h}h`;
  return `${r}m`;
}

function labelBadgeMinutosCelda(minutos) {
  const raw = Math.trunc(Number(minutos) || 0);
  if (raw <= 0) return null;
  const cuerpo = raw >= 60 ? formatearMinutosJornada(raw) : `${raw}m`;
  return `▼ ${cuerpo}`;
}

/**
 * @param {Record<string, unknown>} seg
 * @returns {"presente"|"parcial"|"ausente"}
 */
function estadoTramoDesdeSegmentoAnalitica(seg) {
  if (seg.cubierto !== true) return "ausente";
  const cob = Math.trunc(Number(seg.cobertura_minutos) || 0);
  const carga = Math.trunc(Number(seg.carga_teorica_minutos) || 0);
  if (carga > 0 && cob < carga) return "parcial";
  return "presente";
}

/**
 * @param {Record<string, unknown>} seg
 */
function badgeDesdeSegmentoAnalitica(seg) {
  const tipo = String(seg.incumplimiento_celda_tipo || "").trim();
  const min = Math.trunc(Number(seg.incumplimiento_celda_minutos) || 0);
  if (tipo === "ausente_tramo") {
    return { badge_label: "AUSENTE", badge_tipo: "ausente_tramo" };
  }
  if (min <= 0 || !tipo) {
    return { badge_label: null, badge_tipo: null };
  }
  if (tipo === "tardanza" || tipo === "salida") {
    return { badge_label: labelBadgeMinutosCelda(min), badge_tipo: tipo };
  }
  return { badge_label: labelBadgeMinutosCelda(min), badge_tipo: tipo };
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Record<string, unknown>|null|undefined} capaTeorica
 * @param {Record<string, unknown>|null|undefined} analitica
 * @param {{ fecha_ymd?: string, eval_fingerprint?: string }} [opts]
 * @returns {Record<string, unknown>|null}
 */
export function resolverPresentacionCompuestoCelda(celdaVis, capaTeorica, analitica, opts = {}) {
  const capa = capaTeorica && typeof capaTeorica === "object" ? capaTeorica : {};
  if (!capaMaterializadaConSegmentosMultiples(capa)) return null;

  const anal = analitica && typeof analitica === "object" ? analitica : {};
  if (anal.calculo_por_segmentos !== true) return null;

  const segsCapa = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (segsCapa.length < 2) return null;

  const segsAnal = Array.isArray(anal.segmentos_cumplimiento) ? anal.segmentos_cumplimiento : [];
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

    const estado_tramo = estadoTramoDesdeSegmentoAnalitica(segAnal);
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

    const { badge_label, badge_tipo } = badgeDesdeSegmentoAnalitica(segAnal);

    return {
      segmento_id,
      orden,
      teoria_label,
      fichada_label,
      estado_tramo,
      badge_label,
      badge_tipo,
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
