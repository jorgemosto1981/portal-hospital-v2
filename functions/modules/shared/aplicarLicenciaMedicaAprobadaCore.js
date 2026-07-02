"use strict";

const {
  CFG_MLM_CORTA_ANUAL,
  calcularTramosLicenciaMedicaCorta,
} = require("./licenciaMedicaTramosCore");
const { sumarConsumoCortaAnualAprobado } = require("./licenciaMedicaConsumoCortaAnual");

/**
 * Materializa `licencia_medica` al pasar a `cfg_esa_aprobada` (corta anual Art. 14).
 * No ejecuta MDC — el caller dispara `mutarEstadoSolicitudMedicaMdc` con CONSOLIDAR.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta: string,
 *   dias_solicitados: number,
 *   requiere_junta_medica?: boolean,
 *   dictamen?: Record<string, unknown> | null,
 *   junta_medica_sede_id?: string | null,
 * }} params
 */
async function aplicarLicenciaMedicaAprobada(db, params) {
  const titular = String(params.titular_persona_id || "").trim();
  const fechaDesde = String(params.fecha_desde || "").slice(0, 10);
  const fechaHasta = String(params.fecha_hasta || "").slice(0, 10);
  const dias = Math.max(1, Math.floor(Number(params.dias_solicitados) || 0));

  if (!/^per_/i.test(titular)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "Titular inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
    return { ok: false, codigo: "FECHAS_INVALIDAS", mensaje: "Fechas inválidas." };
  }

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

module.exports = { aplicarLicenciaMedicaAprobada };
