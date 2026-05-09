/**
 * Claves permitidas para `update.field` y `update.section` en el formulario cfg_articulos.
 * Fuente: `cfgArticuloBorradorSchema` en `@web/src/schemas/articulo.schema.js`.
 */

/** No pasar por `field`: usan `variante` o `section`. */
export const ARTICULO_FORM_FORBIDDEN_FIELD_KEYS = Object.freeze(
  new Set(['variantes_sarh', 'filtros_elegibilidad', 'metadata']),
);

/**
 * Campos de primer nivel actualizables vía `update.field` (primitivos o arrays de IDs).
 */
export const ARTICULO_FORM_FIELD_KEYS = Object.freeze([
  'id',
  'norma_principal_tipo_id',
  'norma_principal_referencia',
  'inciso_normativo',
  'titulo',
  'descripcion_operativa',
  'tipo_articulo_id',
  'unidad_medida_id',
  'activo',
  'vigente_desde',
  'vigente_hasta',
  'permite_alta_iniciada_por_jefe_grupo',
  'requiere_autorizacion_jefe',
  'origen_alta_id_default',
  'permite_aprobacion_parcial',
  'regla_split_remanente_id',
  'permite_remanente_sin_articulo',
  'permite_nueva_solicitud_remanente',
  'requiere_decision_rrhh_para_remanente',
  'requiere_auditoria_medica',
  'documentacion_diferida_habilitada',
  'momento_entrega_documentacion_id',
  'plazo_documental_post_inicio_dias',
  'plazo_documental_tipo_dias_id',
  'accion_vencimiento_documental_id',
  'admite_reemplazo',
  'dispara_evento_contrataciones',
  'prioridad_normativa_id',
  'politica_superposicion_id',
  'articulos_incompatibles_ids',
]);

export const ARTICULO_FORM_SECTION_KEYS = Object.freeze([
  'filtros_elegibilidad',
  'metadata',
]);

export const ARTICULO_FORM_FIELD_KEY_SET = new Set(ARTICULO_FORM_FIELD_KEYS);
export const ARTICULO_FORM_SECTION_KEY_SET = new Set(ARTICULO_FORM_SECTION_KEYS);
