"use strict";

const { db } = require("../shared/context");
const { buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const { CFG_EPL_LIQUIDADO_CERRADO } = require("../shared/cfgAsistenciaTurnosIds");

const COL_VIS = "vistas_grilla_mes_agente";

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @returns {Promise<{ cerrado: boolean, estado_periodo_liquidacion_id: string|null }>}
 */
async function consultarEstadoPeriodoLiquidacion(personaId, fechaYmd) {
  const visId = buildVisDocumentId(personaId, fechaYmd);
  if (!visId) return { cerrado: false, estado_periodo_liquidacion_id: null };
  const snap = await db.collection(COL_VIS).doc(visId).get();
  if (!snap.exists) return { cerrado: false, estado_periodo_liquidacion_id: null };
  const id = snap.data()?.estado_periodo_liquidacion_id || null;
  return {
    cerrado: id === CFG_EPL_LIQUIDADO_CERRADO,
    estado_periodo_liquidacion_id: id,
  };
}

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @returns {Promise<void>}
 */
async function assertPeriodoNoCerrado(personaId, fechaYmd) {
  const { cerrado } = await consultarEstadoPeriodoLiquidacion(personaId, fechaYmd);
  if (cerrado) {
    const err = new Error("[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
    err.code = "failed-precondition";
    throw err;
  }
}

module.exports = {
  consultarEstadoPeriodoLiquidacion,
  assertPeriodoNoCerrado,
  COL_VIS,
};
