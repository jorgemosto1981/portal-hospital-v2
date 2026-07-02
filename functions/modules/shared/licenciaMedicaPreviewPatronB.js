"use strict";

const {
  esLicenciaMedicaCortaAnual,
  esLicenciaMedicaLargaEpisodio,
  buildLicenciaMedicaPreviewCorta,
} = require("./licenciaMedicaTramosCore");
const { sumarConsumoCortaAnualAprobado } = require("./licenciaMedicaConsumoCortaAnual");
const { sumarConsumoEpisodioLargaAprobado } = require("./licenciaMedicaConsumoEpisodio");
const { buildLicenciaMedicaPreviewLarga } = require("./licenciaMedicaEpisodioCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   versionData: unknown,
 *   titular_persona_id: string,
 *   anio_calendario: number,
 *   fecha_desde?: string,
 *   dias_solicitados: number,
 *   causal_larga_duracion_id?: string | null,
 *   dictamen_favorable?: boolean,
 * }} params
 */
async function buildLicenciaMedicaPreviewParaPatronB(db, params) {
  const dias = Math.floor(Number(params.dias_solicitados));
  if (!Number.isFinite(dias) || dias < 1) return null;

  if (esLicenciaMedicaCortaAnual(params.versionData)) {
    const consumido_previo = await sumarConsumoCortaAnualAprobado(db, {
      titular_persona_id: params.titular_persona_id,
      anio_calendario: params.anio_calendario,
    });

    return buildLicenciaMedicaPreviewCorta({
      anio_calendario: params.anio_calendario,
      consumido_previo,
      dias_solicitados: dias,
      requiere_junta_medica: dias > 15,
    });
  }

  if (esLicenciaMedicaLargaEpisodio(params.versionData)) {
    const fechaDesde = String(params.fecha_desde || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) return null;

    const consumido_previo_episodio = await sumarConsumoEpisodioLargaAprobado(db, {
      titular_persona_id: params.titular_persona_id,
      fecha_desde: fechaDesde,
    });

    return buildLicenciaMedicaPreviewLarga({
      consumido_previo_episodio,
      dias_solicitados: dias,
      causal_larga_duracion_id: params.causal_larga_duracion_id ?? null,
      dictamen_favorable: params.dictamen_favorable === true,
    });
  }

  return null;
}

module.exports = { buildLicenciaMedicaPreviewParaPatronB };
