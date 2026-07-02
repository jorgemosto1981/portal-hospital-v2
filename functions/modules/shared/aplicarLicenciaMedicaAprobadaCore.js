"use strict";

const {
  CFG_MLM_CORTA_ANUAL,
  CFG_MLM_LARGA_EPISODIO,
  calcularTramosLicenciaMedicaCorta,
} = require("./licenciaMedicaTramosCore");
const { sumarConsumoCortaAnualAprobado } = require("./licenciaMedicaConsumoCortaAnual");
const { sumarConsumoEpisodioLargaAprobado } = require("./licenciaMedicaConsumoEpisodio");
const {
  FASE_MOTOR_S_MED_LARGA,
  proyectarEpisodioContinuo,
} = require("./licenciaMedicaEpisodioCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta: string,
 *   dias_solicitados: number,
 *   requiere_junta_medica?: boolean,
 *   dictamen?: Record<string, unknown> | null,
 *   junta_medica_sede_id?: string | null,
 *   causal_larga_duracion_id?: string | null,
 * }} params
 */
async function aplicarLicenciaMedicaCortaAprobada(db, params) {
  const titular = String(params.titular_persona_id || "").trim();
  const fechaDesde = String(params.fecha_desde || "").slice(0, 10);
  const dias = Math.max(1, Math.floor(Number(params.dias_solicitados) || 0));

  const anio = Number(fechaDesde.slice(0, 4));
  const consumido_previo = await sumarConsumoCortaAnualAprobado(db, {
    titular_persona_id: titular,
    anio_calendario: anio,
  });
  const tramosCalc = calcularTramosLicenciaMedicaCorta({
    consumido_previo,
    dias_solicitados: dias,
  });

  const sede = params.junta_medica_sede_id;
  const licencia_medica = {
    schema_version: 1,
    modo_licencia_medica_id: CFG_MLM_CORTA_ANUAL,
    anio_calendario: anio,
    consumido_previo_al_aprobar: consumido_previo,
    tramos_haberes: tramosCalc.tramos_haberes,
    dias_solicitud_total: dias,
    requiere_junta_medica: params.requiere_junta_medica === true,
    ...(sede ? { junta_medica_sede_id: String(sede).trim() } : {}),
    ...(params.dictamen && typeof params.dictamen === "object"
      ? { dictamen: params.dictamen }
      : {}),
  };

  return {
    ok: true,
    licencia_medica,
    consumido_previo_al_aprobar: consumido_previo,
    tramos_haberes: tramosCalc.tramos_haberes,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta: string,
 *   dias_solicitados: number,
 *   requiere_junta_medica?: boolean,
 *   dictamen?: Record<string, unknown> | null,
 *   junta_medica_sede_id?: string | null,
 *   causal_larga_duracion_id?: string | null,
 * }} params
 */
async function aplicarLicenciaMedicaLargaAprobada(db, params) {
  const titular = String(params.titular_persona_id || "").trim();
  const fechaDesde = String(params.fecha_desde || "").slice(0, 10);
  const dias = Math.max(1, Math.floor(Number(params.dias_solicitados) || 0));
  const causal = String(params.causal_larga_duracion_id || "").trim();

  if (!/^cfg_cld_/i.test(causal)) {
    return {
      ok: false,
      codigo: "CAUSAL_LARGA_REQUERIDA",
      mensaje: "Falta causal_larga_duracion_id (catálogo Art. 19) para licencia larga.",
    };
  }

  const consumido_previo_episodio = await sumarConsumoEpisodioLargaAprobado(db, {
    titular_persona_id: titular,
    fecha_desde: fechaDesde,
  });
  const proy = proyectarEpisodioContinuo({
    consumido_previo_episodio,
    dias_solicitados: dias,
  });
  if (proy.excede_tope_continuo) {
    return {
      ok: false,
      codigo: "EXCEDE_TOPE_EPISODIO",
      mensaje: `El episodio continuo superaría ${proy.tope_episodio_dias} días.`,
    };
  }

  const sede = params.junta_medica_sede_id;
  const licencia_medica = {
    schema_version: 1,
    fase_motor: FASE_MOTOR_S_MED_LARGA,
    modo_licencia_medica_id: CFG_MLM_LARGA_EPISODIO,
    causal_larga_duracion_id: causal,
    consumido_previo_episodio_al_aprobar: consumido_previo_episodio,
    total_episodio_post: proy.total_episodio_post,
    dias_solicitud_total: dias,
    tramos_haberes: null,
    requiere_junta_medica: params.requiere_junta_medica === true,
    dictamen_favorable: true,
    ...(sede ? { junta_medica_sede_id: String(sede).trim() } : {}),
    ...(params.dictamen && typeof params.dictamen === "object"
      ? { dictamen: params.dictamen }
      : {}),
  };

  return {
    ok: true,
    licencia_medica,
    consumido_previo_episodio_al_aprobar: consumido_previo_episodio,
    tramos_haberes: null,
    episodio_preview: proy,
  };
}

/**
 * Materializa `licencia_medica` al pasar a `cfg_esa_aprobada`.
 * Corta → S_MED (tramos 35/70). Larga → S_MED_LARGA (episodio continuo).
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta: string,
 *   dias_solicitados: number,
 *   modo_licencia_medica_id?: string,
 *   requiere_junta_medica?: boolean,
 *   dictamen?: Record<string, unknown> | null,
 *   junta_medica_sede_id?: string | null,
 *   causal_larga_duracion_id?: string | null,
 * }} params
 */
async function aplicarLicenciaMedicaAprobada(db, params) {
  const titular = String(params.titular_persona_id || "").trim();
  const fechaDesde = String(params.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(params.fecha_hasta || "").slice(0, 10);

  if (!/^per_/i.test(titular)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "Titular inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Fechas inválidas." };
  }

  const modo = String(params.modo_licencia_medica_id || CFG_MLM_CORTA_ANUAL).trim();
  if (modo === CFG_MLM_LARGA_EPISODIO) {
    return aplicarLicenciaMedicaLargaAprobada(db, params);
  }
  return aplicarLicenciaMedicaCortaAprobada(db, params);
}

module.exports = {
  aplicarLicenciaMedicaAprobada,
  aplicarLicenciaMedicaCortaAprobada,
  aplicarLicenciaMedicaLargaAprobada,
};
