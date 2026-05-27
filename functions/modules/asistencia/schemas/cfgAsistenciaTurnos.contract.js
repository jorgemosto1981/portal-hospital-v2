"use strict";

/**
 * Contrato JSDoc espejo de web/src/schemas/cfgAsistenciaTurnos.schema.js
 * @see docs/v2/DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md
 */

/**
 * @typedef {object} CfgCatalogoItem
 * @property {string} id — document_id cfg_*
 * @property {string|null} codigo_interno
 * @property {string} titulo_ui
 * @property {number} orden
 */

/**
 * Respuesta de listarCatalogosAsistenciaTurnos.
 * @typedef {object} ListarCatalogosAsistenciaTurnosResponse
 * @property {true} ok
 * @property {object} catalogos
 * @property {CfgCatalogoItem[]} catalogos.cfg_tipo_compensacion_cobertura
 * @property {CfgCatalogoItem[]} catalogos.cfg_estado_periodo_liquidacion
 * @property {CfgCatalogoItem[]} catalogos.cfg_clasificacion_dia_calendario
 * @property {CfgCatalogoItem[]} catalogos.cfg_tipo_override_turno
 */

/** @type {"v2.0.0-rfc-turnos-compuestos"} */
const CFG_ASISTENCIA_TURNOS_CONTRACT_VERSION = "v2.0.0-rfc-turnos-compuestos";

module.exports = {
  CFG_ASISTENCIA_TURNOS_CONTRACT_VERSION,
};
