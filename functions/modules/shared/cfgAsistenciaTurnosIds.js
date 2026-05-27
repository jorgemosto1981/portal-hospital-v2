"use strict";

/**
 * IDs fijos cfg asistencia/turnos — SSoT: scripts/seed-v2/seed-ids-asistencia-turnos.v2.json
 * Contrato: docs/v2/DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md
 */

const path = require("path");
const { readFileSync } = require("fs");

const seedPath = path.join(__dirname, "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json");
const seedIds = JSON.parse(readFileSync(seedPath, "utf8"));

const tcc = seedIds.cfg_tipo_compensacion_cobertura || {};
const epl = seedIds.cfg_estado_periodo_liquidacion || {};
const cdc = seedIds.cfg_clasificacion_dia_calendario || {};
const tov = seedIds.cfg_tipo_override_turno || {};

module.exports = {
  seedIds,
  CFG_TCC_CAMBIO_INTERNO: tcc.CAMBIO_INTERNO,
  CFG_TCC_EXTRA_PAGA: tcc.EXTRA_PAGA,
  CFG_TCC_DEVOLUCION_HORAS: tcc.DEVOLUCION_HORAS,
  CFG_EPL_ABIERTO: epl.ABIERTO,
  CFG_EPL_CONCILIADO: epl.CONCILIADO,
  CFG_EPL_LIQUIDADO_CERRADO: epl.LIQUIDADO_CERRADO,
  CFG_CDC_HABIL: cdc.HABIL,
  CFG_CDC_FIN_DE_SEMANA: cdc.FIN_DE_SEMANA,
  CFG_CDC_FERIADO: cdc.FERIADO,
  CFG_CDC_ASUETO: cdc.ASUETO,
  CFG_CDC_INSTITUCIONAL: cdc.INSTITUCIONAL,
  CFG_TOV_COBERTURA_PARCIAL: tov.COBERTURA_PARCIAL,
};
