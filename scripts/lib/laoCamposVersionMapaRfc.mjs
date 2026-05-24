/**
 * Mapa de Integridad Semántica — RFC LAO motor wiring §4 (rutas bajo cfgArticuloVersionSchema).
 * SSoT para CI R5: `scripts/auditar-campos-version-consumidos-lao.mjs`
 *
 * Categorías:
 * - consumido: motor LAO / snapshot / wizard (Gate B/A/I)
 * - na_lao: válido en schema; sin consumo en motor LAO (§4.4 N/A)
 * - fuera_motor: ciclo publicación / post-alta (§4.1 FM, §4.5 FM, §4.7)
 */

/** @type {readonly string[]} */
export const CAMPOS_CONSUMIDOS_LAO = [
  // §4.1 — bloque_identidad_naturaleza
  "bloque_identidad_naturaleza.es_lao_anual",
  "bloque_identidad_naturaleza.codigo",
  "bloque_identidad_naturaleza.nombre",
  "bloque_identidad_naturaleza.inciso_normativo",
  "bloque_identidad_naturaleza.normativa_habilitante.*",
  "bloque_identidad_naturaleza.fecha_desde",
  "bloque_identidad_naturaleza.fecha_hasta",
  "bloque_identidad_naturaleza.es_sancion",
  "bloque_identidad_naturaleza.es_inasistencia",
  "bloque_identidad_naturaleza.es_sin_goce",
  "bloque_identidad_naturaleza.es_licencia_medica",
  "bloque_identidad_naturaleza.requiere_dictamen",
  "bloque_identidad_naturaleza.visualizacion.codigo_grilla",
  "bloque_identidad_naturaleza.visualizacion.color_ui",
  // §4.2 — bloque_impacto_economico
  "bloque_impacto_economico.justifica_sueldo_id",
  "bloque_impacto_economico.suma_para_sac",
  "bloque_impacto_economico.afecta_presentismo",
  "bloque_impacto_economico.acumula_reparto_obra_social",
  "bloque_impacto_economico.invalida_reparto_obra_social",
  "bloque_impacto_economico.suma_antiguedad_lao",
  // §4.3 — bloque_elegibilidad_filtros
  "bloque_elegibilidad_filtros.escalafon_ids",
  "bloque_elegibilidad_filtros.agrupamiento_ids",
  "bloque_elegibilidad_filtros.tipo_vinculo_ids",
  "bloque_elegibilidad_filtros.cargo_funcional_ids",
  "bloque_elegibilidad_filtros.grupo_trabajo_ids",
  "bloque_elegibilidad_filtros.persona_ids",
  "bloque_elegibilidad_filtros.genero_ids",
  "bloque_elegibilidad_filtros.antiguedad_minima_meses",
  "bloque_elegibilidad_filtros.requiere_declaracion_familiar",
  "bloque_elegibilidad_filtros.edad_limite_familiar",
  // §4.4 — bloque_topes_plazos_computo
  "bloque_topes_plazos_computo.regla_computo_dias_id",
  "bloque_topes_plazos_computo.usa_calendario_institucional",
  "bloque_topes_plazos_computo.unidad_medida_id",
  "bloque_topes_plazos_computo.unidad_minima_consumo_id",
  "bloque_topes_plazos_computo.intervalo_gracia_dias",
  "bloque_topes_plazos_computo.multiplicador_valor",
  "bloque_topes_plazos_computo.reinicio_ciclo_id",
  "bloque_topes_plazos_computo.origen_saldo_id",
  "bloque_topes_plazos_computo.accion_saldo_id",
  "bloque_topes_plazos_computo.depende_rda",
  "bloque_topes_plazos_computo.cupo_dias_por_ciclo",
  "bloque_topes_plazos_computo.tope_dias_por_evento",
  "bloque_topes_plazos_computo.dias_minimos_por_evento",
  "bloque_topes_plazos_computo.tope_frecuencia_mensual",
  "bloque_topes_plazos_computo.ambito_consumo_id",
  "bloque_topes_plazos_computo.correspondencia_anio",
  "bloque_topes_plazos_computo.fecha_corte_antiguedad",
  "bloque_topes_plazos_computo.matriz_antiguedad_reglas",
  "bloque_topes_plazos_computo.mes_dia_apertura_solicitudes",
  "bloque_topes_plazos_computo.tse_minimo_dias_base",
  "bloque_topes_plazos_computo.permite_calculo_proporcional_tse",
  "bloque_topes_plazos_computo.nivel_ocupacion_dia_id",
  "bloque_topes_plazos_computo.politica_superposicion_id",
  // §4.5 — bloque_acumulacion_sucesion
  "bloque_acumulacion_sucesion.caducidad_tipo_id",
  "bloque_acumulacion_sucesion.caducidad_limite_meses",
  "bloque_acumulacion_sucesion.permite_prorroga",
  "bloque_acumulacion_sucesion.prorroga_articulo_relacion_id",
  "bloque_acumulacion_sucesion.meses_arrastre",
  // §4.5 — bloque_workflow_sla_cobertura
  "bloque_workflow_sla_cobertura.circuito_ingreso_ids",
  "bloque_workflow_sla_cobertura.plazo_preaviso_normativa_dias",
  "bloque_workflow_sla_cobertura.plazo_preaviso_interno_dias",
  "bloque_workflow_sla_cobertura.permite_retroactividad",
  "bloque_workflow_sla_cobertura.logistica_aviso_habilitada",
  "bloque_workflow_sla_cobertura.toma_conocimiento_limitada",
  "bloque_workflow_sla_cobertura.requiere_toma_conocimiento_superior",
  // §4.6 — bloque_documentacion_convivencia
  "bloque_documentacion_convivencia.requiere_adjunto_obligatorio",
  "bloque_documentacion_convivencia.accion_incumplimiento_doc_id",
  "bloque_documentacion_convivencia.requiere_doc_previa",
  "bloque_documentacion_convivencia.requiere_doc_posterior",
  "bloque_documentacion_convivencia.plazo_doc_previa_dias",
  "bloque_documentacion_convivencia.plazo_doc_posterior_dias",
];

/** @type {readonly string[]} — §4.4 N/A LAO */
export const CAMPOS_NA_LAO = [
  "bloque_topes_plazos_computo.regla_computo_horas_id",
  "bloque_topes_plazos_computo.fraccionamiento_habilitado",
  "bloque_topes_plazos_computo.modulo_fraccionamiento_minutos",
];

/** @type {readonly string[]} — §4.1 / §4.5 FM (no orquestador de alta) */
export const CAMPOS_FUERA_MOTOR = [
  "version_semantica",
  "estado_version_id",
  "publicada_en",
  "publicada_por_persona_id",
];

/** @type {readonly string[]} */
export const CAMPOS_PERMITIDOS_VERSION_LAO = [
  ...CAMPOS_CONSUMIDOS_LAO,
  ...CAMPOS_NA_LAO,
  ...CAMPOS_FUERA_MOTOR,
];

/**
 * @param {string} path
 * @param {readonly string[]} allowlist
 */
export function pathPermitidoEnMapa(path, allowlist = CAMPOS_PERMITIDOS_VERSION_LAO) {
  for (const entry of allowlist) {
    if (entry.endsWith(".*")) {
      const base = entry.slice(0, -2);
      if (path === base || path.startsWith(`${base}.`)) return true;
    } else if (path === entry) {
      return true;
    }
  }
  return false;
}
