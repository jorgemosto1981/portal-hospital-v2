"use strict";

const {
  esLicenciaMedicaCortaAnual,
  buildLicenciaMedicaPreviewCorta,
} = require("./licenciaMedicaTramosCore");
const { sumarConsumoCortaAnualAprobado } = require("./licenciaMedicaConsumoCortaAnual");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   versionData: unknown,
 *   titular_persona_id: string,
 *   anio_calendario: number,
 *   dias_solicitados: number,
 * }} params
 */
async function buildLicenciaMedicaPreviewParaPatronB(db, params) {
  if (!esLicenciaMedicaCortaAnual(params.versionData)) return null;
  const dias = Math.floor(Number(params.dias_solicitados));
  if (!Number.isFinite(dias) || dias < 1) return null;

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

module.exports = { buildLicenciaMedicaPreviewParaPatronB };
