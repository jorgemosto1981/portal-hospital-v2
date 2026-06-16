"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { celdaEsperaFichada } = require("./grillaFichadaPresencia");

/**
 * RFC Fase F §5 — licencia aprobada eclipsa evaluación fichada / ROJO.
 */

const COLOR_MDC_APROBADO = "#3B82F6";

/**
 * @param {unknown} eventos
 * @param {Record<string, unknown>|null|undefined} celda
 */
function listarEventosLicenciaCelda(eventos, celda) {
  if (Array.isArray(eventos)) return eventos;
  if (celda && Array.isArray(celda.eventos)) return celda.eventos;
  return [];
}

/** @param {Record<string, unknown>} ev */
function eventoLicenciaEnRevision(ev) {
  const est = String(ev?.estado_solicitud_id || "").toLowerCase();
  return est.includes("revision") || est.includes("rechaz");
}

/** @param {Record<string, unknown>} ev */
function eventoLicenciaAprobadoParaFichada(ev) {
  if (!String(ev?.codigo_grilla || "").trim()) return false;
  if (eventoLicenciaEnRevision(ev)) return false;
  const c = String(ev?.color_ui || "").trim().toUpperCase();
  if (c === COLOR_MDC_APROBADO) return true;
  if (String(ev?.estado_solicitud_id || "") === "cfg_esa_aprobada") return true;
  return !eventoLicenciaEnRevision(ev);
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {unknown} [eventos]
 */
function licenciaCubreDiaFichada(celda, eventos) {
  const evs = listarEventosLicenciaCelda(eventos, celda);
  const aprobados = evs.filter((ev) => ev && typeof ev === "object" && eventoLicenciaAprobadoParaFichada(ev));
  if (aprobados.length === 0) return false;

  const tipo = String(celda?.tipo_dia || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (tipo === "franco" || celda?.es_franco === true) return true;

  if (celdaEsperaFichada(celda)) return true;

  return false;
}

/**
 * Día sin expectativa de fichada (no aplica motor reloj).
 * @param {Record<string, unknown>|null|undefined} celda
 */
function celdaSinExpectativaFichada(celda) {
  if (!celda || typeof celda !== "object") return true;
  if (celdaEsperaFichada(celda)) return false;
  const fn = Number(celda.fichadas_esperadas);
  return !Number.isFinite(fn) || fn <= 0;
}

module.exports = { listarEventosLicenciaCelda, eventoLicenciaAprobadoParaFichada, licenciaCubreDiaFichada, celdaSinExpectativaFichada };
