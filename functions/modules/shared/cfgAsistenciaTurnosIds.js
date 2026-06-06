"use strict";

/**
 * IDs fijos cfg asistencia/turnos — SSoT: scripts/seed-v2/seed-ids-asistencia-turnos.v2.json
 * Contrato: docs/v2/DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md
 */

const seedIds = {
  projectId: "portal-hospital-v2",
  generado: "2026-05-27",
  nota: "SSoT de document_id para cfg asistencia/turnos.",
  cfg_tipo_compensacion_cobertura: {
    CAMBIO_INTERNO: "cfg_tcc_01KSN4ZJPJZ6H3ARPEX750YBTH",
    EXTRA_PAGA: "cfg_tcc_01KSN4ZJPT494X97SD4N2GB2XF",
    DEVOLUCION_HORAS: "cfg_tcc_01KSN4ZJPTVC0PNJGXSAC2MMZ",
  },
  cfg_estado_periodo_liquidacion: {
    ABIERTO: "cfg_epl_01KSN4ZJPTDMSK2K7AR2SV4B1R",
    CONCILIADO: "cfg_epl_01KSN4ZJPVQ8GPKGNZV7HM9A2E",
    LIQUIDADO_CERRADO: "cfg_epl_01KSN4ZJPVJE8C6X1VS2HQSR20",
  },
  cfg_clasificacion_dia_calendario: {
    HABIL: "cfg_cdc_01KSN4ZJPVPW986NK2K2JV0PP3",
    FIN_DE_SEMANA: "cfg_cdc_01KSN4ZJPV5T8KD87A8PYSB4NN",
    FERIADO: "cfg_cdc_01KSN4ZJPVM4YPG01KSQ8H78GY",
    ASUETO: "cfg_cdc_01KSN4ZJPWHGW22YKBRVY8X10S",
    INSTITUCIONAL: "cfg_cdc_01KSN4ZJPWV1H7MWK3JCAT11SN",
  },
  cfg_tipo_override_turno: {
    COBERTURA_PARCIAL: "cfg_tov_01KSN4ZJPXNNGSY07ZVXPQSSE5",
  },
};

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
