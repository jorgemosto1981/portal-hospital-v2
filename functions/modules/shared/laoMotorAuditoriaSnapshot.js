"use strict";

/**
 * Snapshot de auditoría LAO — campos informativos de la versión aplicada.
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md §5
 */

const { resolveLaoMotorConfig } = require("./laoMotorConfigResolver");
const { MOTOR_VERSION } = require("./laoAsignacionDiasCore");

/**
 * @param {object} versionData
 */
function ensamblarContextoDeAuditoria(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const impacto = versionData?.bloque_impacto_economico || {};
  const workflow = versionData?.bloque_workflow_sla_cobertura || {};
  const normativa = ident.normativa_habilitante || {};

  return {
    display: {
      codigo: ident.codigo ?? null,
      nombre: ident.nombre ?? null,
      inciso_normativo: ident.inciso_normativo ?? null,
      normativa_habilitante: {
        decreto: normativa.decreto ?? null,
        resolucion: normativa.resolucion ?? null,
        interno_efector: normativa.interno_efector ?? null,
      },
    },
    metadatos_identidad: {
      es_sancion: ident.es_sancion === true,
      es_inasistencia: ident.es_inasistencia === true,
      es_sin_goce: ident.es_sin_goce === true,
      es_licencia_medica: ident.es_licencia_medica === true,
      requiere_dictamen: ident.requiere_dictamen === true,
      es_lao_anual: ident.es_lao_anual === true,
    },
    impacto: {
      justifica_sueldo_id: impacto.justifica_sueldo_id ?? null,
      suma_para_sac: impacto.suma_para_sac === true,
      afecta_presentismo: impacto.afecta_presentismo === true,
      acumula_reparto_obra_social: impacto.acumula_reparto_obra_social === true,
      invalida_reparto_obra_social: impacto.invalida_reparto_obra_social === true,
      suma_antiguedad_lao: impacto.suma_antiguedad_lao === true,
    },
    workflow: {
      logistica_aviso_habilitada: workflow.logistica_aviso_habilitada === true,
      toma_conocimiento_limitada: workflow.toma_conocimiento_limitada === true,
      requiere_toma_conocimiento_superior: workflow.requiere_toma_conocimiento_superior === true,
      plazo_preaviso_normativa_dias: workflow.plazo_preaviso_normativa_dias ?? null,
      plazo_preaviso_interno_dias: workflow.plazo_preaviso_interno_dias ?? null,
      permite_retroactividad: workflow.permite_retroactividad === true,
    },
  };
}

/**
 * Subset de versión usado en la decisión (no el doc completo).
 * @param {object} versionData
 * @param {string} versionId
 */
function buildConfigUsada(versionData, versionId) {
  let motorConfig;
  try {
    motorConfig = resolveLaoMotorConfig(versionData);
  } catch {
    motorConfig = null;
  }
  const topes = versionData?.bloque_topes_plazos_computo || {};
  return {
    version_aplicada_id: versionId || null,
    tse_minimo_dias_base: motorConfig?.tseMinimoDiasBase ?? null,
    mes_dia_apertura_solicitudes: motorConfig?.mesDiaApertura ?? null,
    permite_calculo_proporcional_tse: motorConfig?.permiteProporcional ?? null,
    dias_minimos_por_evento: motorConfig?.diasMinimosPorEvento ?? null,
    correspondencia_anio: topes.correspondencia_anio ?? null,
    regla_computo_dias_id: topes.regla_computo_dias_id ?? null,
    politica_superposicion_id: topes.politica_superposicion_id ?? null,
  };
}

/**
 * @param {object} params
 */
function buildMotorSnapshot(params) {
  const {
    versionId,
    checks = [],
    warnings = [],
    asignacionBlock = null,
    contextoAuditoria,
    configUsada,
    eligible,
  } = params;

  return {
    motor_version: MOTOR_VERSION,
    evaluado_en: new Date().toISOString(),
    version_aplicada_id: versionId || null,
    config_usada: configUsada,
    checks,
    warnings,
    asignacion: asignacionBlock,
    contexto_auditoria: contextoAuditoria,
    eligible: Boolean(eligible),
  };
}

module.exports = {
  ensamblarContextoDeAuditoria,
  buildConfigUsada,
  buildMotorSnapshot,
};
