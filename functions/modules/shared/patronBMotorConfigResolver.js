"use strict";

/**
 * Config resolver Patron B — cableado total de los 7 bloques del configurador.
 *
 * Lee los ~60 campos de la version de articulo y los normaliza con defaults
 * explicitos. Los campos null se ignoran en runtime pero ya tienen consumidor
 * registrado. Cuando RRHH llene un campo futuro, el motor lo respeta sin redeploy.
 *
 * @see docs/v2/RFC_PATRON_B_MOTOR_V2.md
 */

const { resolvePatronSaldo, PATRON_SALDO_B } = require("./resolvePatronSaldo");

/**
 * Assert que la version es Patron B.
 * @param {object} versionData
 */
function assertPatronSaldoB(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  const patron = resolvePatronSaldo(
    topes.reinicio_ciclo_id,
    topes.origen_saldo_id,
    ident.es_lao_anual === true,
  );
  if (patron !== PATRON_SALDO_B) {
    const err = new Error(`Patron saldo esperado B, obtenido: ${patron || "null"}`);
    err.code = "ERROR_PATRON_SALDO_NO_B";
    throw err;
  }
  return patron;
}

/**
 * Resuelve config completa de los 7 bloques para motor Patron B.
 * @param {object} versionData
 * @returns {object}
 */
function resolvePatronBMotorConfig(versionData) {
  assertPatronSaldoB(versionData);

  const ident = versionData?.bloque_identidad_naturaleza || {};
  const impacto = versionData?.bloque_impacto_economico || {};
  const elegib = versionData?.bloque_elegibilidad_filtros || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  const acum = versionData?.bloque_acumulacion_sucesion || {};
  const workflow = versionData?.bloque_workflow_sla_cobertura || {};
  const docs = versionData?.bloque_documentacion_convivencia || {};
  const normativa = ident.normativa_habilitante || {};
  const vis = ident.visualizacion || {};

  return {
    // --- Bloque 1: Identidad y naturaleza ---
    codigo: ident.codigo ?? null,
    nombre: ident.nombre ?? null,
    inciso_normativo: ident.inciso_normativo ?? null,
    normativa_habilitante_decreto: normativa.decreto ?? null,
    normativa_habilitante_resolucion: normativa.resolucion ?? null,
    normativa_habilitante_interno_efector: normativa.interno_efector ?? null,
    es_lao_anual: ident.es_lao_anual === true,
    es_sancion: ident.es_sancion === true,
    es_inasistencia: ident.es_inasistencia === true,
    es_sin_goce: ident.es_sin_goce === true,
    es_licencia_medica: ident.es_licencia_medica === true,
    requiere_dictamen: ident.requiere_dictamen === true,
    codigo_grilla: vis.codigo_grilla ?? null,
    color_ui: vis.color_ui ?? null,
    fecha_desde_version: ident.fecha_desde ?? null,
    fecha_hasta_version: ident.fecha_hasta ?? null,

    // --- Bloque 2: Impacto economico ---
    justifica_sueldo_id: impacto.justifica_sueldo_id ?? null,
    suma_para_sac: impacto.suma_para_sac === true,
    afecta_presentismo: impacto.afecta_presentismo === true,
    acumula_reparto_obra_social: impacto.acumula_reparto_obra_social === true,
    invalida_reparto_obra_social: impacto.invalida_reparto_obra_social === true,
    suma_antiguedad_lao: impacto.suma_antiguedad_lao === true,

    // --- Bloque 3: Elegibilidad ---
    escalafon_ids: Array.isArray(elegib.escalafon_ids) ? elegib.escalafon_ids : [],
    agrupamiento_ids: Array.isArray(elegib.agrupamiento_ids) ? elegib.agrupamiento_ids : [],
    tipo_vinculo_ids: Array.isArray(elegib.tipo_vinculo_ids) ? elegib.tipo_vinculo_ids : [],
    cargo_funcional_ids: Array.isArray(elegib.cargo_funcional_ids) ? elegib.cargo_funcional_ids : [],
    grupo_trabajo_ids: Array.isArray(elegib.grupo_trabajo_ids) ? elegib.grupo_trabajo_ids : [],
    persona_ids: Array.isArray(elegib.persona_ids) ? elegib.persona_ids : [],
    genero_ids: Array.isArray(elegib.genero_ids) ? elegib.genero_ids : [],
    antiguedad_minima_meses: Number(elegib.antiguedad_minima_meses) || 0,
    requiere_declaracion_familiar: elegib.requiere_declaracion_familiar === true,
    edad_limite_familiar: elegib.edad_limite_familiar ?? null,

    // --- Bloque 4: Topes, plazos y computo (core motor) ---
    regla_computo_dias_id: topes.regla_computo_dias_id ?? null,
    usa_calendario_institucional: topes.usa_calendario_institucional === true,
    ambito_consumo_id: topes.ambito_consumo_id ?? null,
    unidad_medida_id: topes.unidad_medida_id ?? null,
    unidad_minima_consumo_id: topes.unidad_minima_consumo_id ?? null,
    modulo_fraccionamiento_minutos: Number(topes.modulo_fraccionamiento_minutos) || 15,
    fraccionamiento_habilitado: topes.fraccionamiento_habilitado === true,
    intervalo_gracia_dias: Number(topes.intervalo_gracia_dias) || 0,
    regla_computo_horas_id: topes.regla_computo_horas_id ?? null,
    reinicio_ciclo_id: topes.reinicio_ciclo_id ?? null,
    depende_rda: topes.depende_rda === true,
    accion_saldo_id: topes.accion_saldo_id ?? null,
    multiplicador_valor: Number(topes.multiplicador_valor) || 1,
    origen_saldo_id: topes.origen_saldo_id ?? null,
    cupo_dias_por_ciclo: topes.cupo_dias_por_ciclo ?? null,
    tope_frecuencia_mensual: topes.tope_frecuencia_mensual ?? null,
    tope_dias_por_evento: topes.tope_dias_por_evento ?? null,
    dias_minimos_por_evento: topes.dias_minimos_por_evento ?? null,
    nivel_ocupacion_dia_id: topes.nivel_ocupacion_dia_id ?? null,
    politica_superposicion_id: topes.politica_superposicion_id ?? null,

    // --- Bloque 5: Acumulacion y sucesion ---
    caducidad_tipo_id: acum.caducidad_tipo_id ?? null,
    caducidad_limite_meses: acum.caducidad_limite_meses ?? null,
    permite_prorroga: acum.permite_prorroga === true,
    prorroga_articulo_relacion_id: acum.prorroga_articulo_relacion_id ?? null,
    meses_arrastre: Number(acum.meses_arrastre) || 0,

    // --- Bloque 6: Workflow / SLA ---
    circuito_ingreso_ids: Array.isArray(workflow.circuito_ingreso_ids) ? workflow.circuito_ingreso_ids : [],
    plazo_preaviso_normativa_dias: workflow.plazo_preaviso_normativa_dias ?? null,
    plazo_preaviso_interno_dias: workflow.plazo_preaviso_interno_dias ?? null,
    logistica_aviso_habilitada: workflow.logistica_aviso_habilitada === true,
    toma_conocimiento_limitada: workflow.toma_conocimiento_limitada === true,
    permite_retroactividad: workflow.permite_retroactividad === true,
    requiere_toma_conocimiento_superior: workflow.requiere_toma_conocimiento_superior === true,

    // --- Bloque 7: Documentacion y convivencia ---
    requiere_adjunto_obligatorio: docs.requiere_adjunto_obligatorio === true,
    requiere_doc_previa: docs.requiere_doc_previa === true,
    plazo_doc_previa_dias: docs.plazo_doc_previa_dias ?? null,
    requiere_doc_posterior: docs.requiere_doc_posterior === true,
    plazo_doc_posterior_dias: docs.plazo_doc_posterior_dias ?? null,
    accion_incumplimiento_doc_id: docs.accion_incumplimiento_doc_id ?? null,
  };
}

/**
 * Subset decisional para config_usada del motor_snapshot.
 * @param {object} cfg — resultado de resolvePatronBMotorConfig
 * @param {string} versionId
 */
function buildPatronBConfigUsada(cfg, versionId) {
  return {
    version_aplicada_id: versionId || null,
    motor_tipo: "patron-b-v2",

    // Campos decisionales activos
    tope_dias_por_evento: cfg.tope_dias_por_evento,
    tope_frecuencia_mensual: cfg.tope_frecuencia_mensual,
    cupo_dias_por_ciclo: cfg.cupo_dias_por_ciclo,
    dias_minimos_por_evento: cfg.dias_minimos_por_evento,
    depende_rda: cfg.depende_rda,
    regla_computo_dias_id: cfg.regla_computo_dias_id,
    reinicio_ciclo_id: cfg.reinicio_ciclo_id,
    origen_saldo_id: cfg.origen_saldo_id,
    politica_superposicion_id: cfg.politica_superposicion_id,
    unidad_medida_id: cfg.unidad_medida_id,
    ambito_consumo_id: cfg.ambito_consumo_id,
    accion_saldo_id: cfg.accion_saldo_id,
    multiplicador_valor: cfg.multiplicador_valor,

    // Workflow
    plazo_preaviso_normativa_dias: cfg.plazo_preaviso_normativa_dias,
    plazo_preaviso_interno_dias: cfg.plazo_preaviso_interno_dias,
    permite_retroactividad: cfg.permite_retroactividad,
    requiere_toma_conocimiento_superior: cfg.requiere_toma_conocimiento_superior,
    logistica_aviso_habilitada: cfg.logistica_aviso_habilitada,

    // Documentacion
    requiere_adjunto_obligatorio: cfg.requiere_adjunto_obligatorio,
    requiere_doc_previa: cfg.requiere_doc_previa,
    requiere_doc_posterior: cfg.requiere_doc_posterior,

    // Acumulacion
    caducidad_tipo_id: cfg.caducidad_tipo_id,
    meses_arrastre: cfg.meses_arrastre,

    // Elegibilidad (resumen)
    antiguedad_minima_meses: cfg.antiguedad_minima_meses,
    requiere_declaracion_familiar: cfg.requiere_declaracion_familiar,
  };
}

module.exports = {
  assertPatronSaldoB,
  resolvePatronBMotorConfig,
  buildPatronBConfigUsada,
};
