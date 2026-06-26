"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Motor de tramos Art. 14 — enfermedad de corta duración (año calendario 35 + 35 + sin goce).
 * @see docs/v2/RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md
 */

const CFG_MLM_CORTA_ANUAL = "cfg_mlm_corta_anual";
const CFG_MLM_LARGA_EPISODIO = "cfg_mlm_larga_episodio";

const ESTADO_SOLICITUD_APROBADA = "cfg_esa_aprobada";

const LIMITE_TRAMO_100 = 35;
const LIMITE_TRAMO_60 = 70;
const CUPO_TRAMO_60 = 35;

/**
 * @param {unknown} versionData
 * @returns {string | null}
 */
function leerModoLicenciaMedicaDesdeVersion(versionData) {
  const ident =
    versionData && typeof versionData === "object" ? versionData.bloque_identidad_naturaleza : null;
  if (!ident || ident.es_licencia_medica !== true) return null;
  const raw = ident.modo_licencia_medica_id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

/**
 * @param {unknown} versionData
 */
function esLicenciaMedicaCortaAnual(versionData) {
  return leerModoLicenciaMedicaDesdeVersion(versionData) === CFG_MLM_CORTA_ANUAL;
}

/**
 * @param {{ consumido_previo?: unknown, dias_solicitados?: unknown }} params
 */
function calcularTramosLicenciaMedicaCorta(params) {
  const consumido_previo = normalizarEnteroNoNegativo(params?.consumido_previo);
  const dias_solicitados = normalizarEnteroPositivo(params?.dias_solicitados);
  if (dias_solicitados == null) {
    throw new Error("dias_solicitados debe ser un entero >= 1");
  }
  if (consumido_previo == null) {
    throw new Error("consumido_previo debe ser un entero >= 0");
  }

  const restante_100 = Math.max(0, LIMITE_TRAMO_100 - consumido_previo);
  const restante_60 = Math.max(0, LIMITE_TRAMO_60 - Math.max(consumido_previo, LIMITE_TRAMO_100));

  const n100 = Math.min(dias_solicitados, restante_100);
  const rem = dias_solicitados - n100;
  const n60 = Math.min(rem, restante_60);
  const n0 = rem - n60;

  const tramos_haberes = {
    100: n100,
    60: n60,
    0: n0,
  };

  const totalPosterior = consumido_previo + dias_solicitados;

  return {
    tramos_haberes,
    tramos: tramos_haberes,
    dias_solicitud_total: dias_solicitados,
    consumido_previo,
    cruza_limite_35: consumido_previo < LIMITE_TRAMO_100 && totalPosterior > LIMITE_TRAMO_100,
    cruza_limite_70: consumido_previo < LIMITE_TRAMO_60 && totalPosterior > LIMITE_TRAMO_60,
    restante_100_post: Math.max(0, LIMITE_TRAMO_100 - totalPosterior),
    restante_60_post: Math.max(0, LIMITE_TRAMO_60 - Math.max(totalPosterior, LIMITE_TRAMO_100)),
  };
}

/**
 * @param {{
 *   modo_licencia_medica_id?: string,
 *   anio_calendario: number,
 *   consumido_previo: number,
 *   dias_solicitados: number,
 *   requiere_junta_medica?: boolean,
 * }} input
 */
function buildLicenciaMedicaPreviewCorta(input) {
  const calc = calcularTramosLicenciaMedicaCorta({
    consumido_previo: input.consumido_previo,
    dias_solicitados: input.dias_solicitados,
  });
  const t = calc.tramos_haberes;
  const partes = [];
  if (t[100] > 0) partes.push(`${t[100]} día${t[100] === 1 ? "" : "s"} al 100%`);
  if (t[60] > 0) partes.push(`${t[60]} día${t[60] === 1 ? "" : "s"} al 60%`);
  if (t[0] > 0) partes.push(`${t[0]} día${t[0] === 1 ? "" : "s"} sin remuneración`);

  let mensaje_ui = "";
  if (input.requiere_junta_medica === true) {
    mensaje_ui =
      "Supera 15 días continuos: la solicitud pasará a revisión de junta médica antes del jefe. ";
  }
  if (partes.length === 0) {
    mensaje_ui += "Sin días a computar en esta solicitud.";
  } else {
    mensaje_ui += `Esta solicitud consume ${partes.join(" y ")}.`;
    if (calc.restante_100_post === 0 && t[100] > 0) {
      mensaje_ui += ` Te quedan 0 días al 100% en ${input.anio_calendario}.`;
    } else if (calc.restante_100_post > 0) {
      mensaje_ui += ` Te quedan ${calc.restante_100_post} día${
        calc.restante_100_post === 1 ? "" : "s"
      } al 100% en ${input.anio_calendario}.`;
    }
  }

  const mensaje_ui_corto = partes
    .map((p) => {
      if (p.includes("100%")) return `${t[100]} al 100%`;
      if (p.includes("60%")) return `${t[60]} al 60%`;
      return `${t[0]} sin goce`;
    })
    .join(" · ");

  return {
    schema_version: 1,
    modo_licencia_medica_id: input.modo_licencia_medica_id || CFG_MLM_CORTA_ANUAL,
    anio_calendario: input.anio_calendario,
    dias_acumulados_previos: calc.consumido_previo,
    tramos_haberes: {
      "100": t[100],
      "60": t[60],
      "0": t[0],
    },
    dias_solicitud_total: calc.dias_solicitud_total,
    cruza_limite_35: calc.cruza_limite_35,
    cruza_limite_70: calc.cruza_limite_70,
    requiere_junta_medica: input.requiere_junta_medica === true,
    mensaje_ui: mensaje_ui.trim(),
    mensaje_ui_corto: mensaje_ui_corto || "",
    restante_100_post: calc.restante_100_post,
    restante_60_post: calc.restante_60_post,
  };
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function normalizarEnteroNoNegativo(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function normalizarEnteroPositivo(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

module.exports = { LIMITE_TRAMO_100, LIMITE_TRAMO_60, CUPO_TRAMO_60, CFG_MLM_CORTA_ANUAL, CFG_MLM_LARGA_EPISODIO, ESTADO_SOLICITUD_APROBADA, leerModoLicenciaMedicaDesdeVersion, esLicenciaMedicaCortaAnual, calcularTramosLicenciaMedicaCorta, buildLicenciaMedicaPreviewCorta };
