/**
 * Catálogos dominio Artículos V2 (seed: docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json).
 * Listados en Configuración maestra como solo lectura (no usar guardarOpción: pisaría campos enriquecidos).
 */

/** @typedef {{ key: string; etiqueta: string; collectionName: string; idPrefix: string; soloLectura?: boolean }} ItemCatalogoCfg */

/** @param {string} collectionName */
function etiquetaDesdeNombre(collectionName) {
  const s = collectionName.replace(/^cfg_/, "").replace(/_/g, " ");
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nombres de colección Firestore (mismas claves que el JSON de seed, salvo envoltorio `cfg_tipo_evento_articulos`). */
export const COLECCIONES_FIRESTORE_ARTICULOS_V2 = Object.freeze([
  "cfg_accion_incumplimiento_documental",
  "cfg_accion_saldo",
  "cfg_accion_vencimiento",
  "cfg_calendario_feriados_institucional",
  "cfg_circuito_ingreso",
  "cfg_estado_articulo",
  "cfg_estado_solicitud_articulo",
  "cfg_estado_version_articulo",
  "cfg_fuente_decision_solicitud",
  "cfg_momento_entrega_documentacion",
  "cfg_motivo_rechazo_solicitud",
  "cfg_nivel_ocupacion_dia",
  "cfg_operador_comparacion",
  "cfg_origen_alta_solicitud",
  "cfg_origen_normativo_articulo",
  "cfg_origen_saldo",
  "cfg_paso_workflow_articulo",
  "cfg_politica_superposicion",
  "cfg_prioridad_normativa",
  "cfg_reinicio_ciclo_cuota",
  "cfg_regla_computo_dias",
  "cfg_regla_computo_horas",
  "cfg_regla_split_remanente",
  "cfg_rol_aprobador",
  "cfg_tipo_acumulacion",
  "cfg_tipo_caducidad",
  "cfg_tipo_articulo",
  "cfg_tipo_computo_plazo",
  "cfg_tipo_convivencia_articulo",
  "cfg_tipo_documentacion",
  "cfg_tipo_filtro_elegibilidad",
  "cfg_tipo_fraccionamiento",
  "cfg_tipo_incompatibilidad_articulo",
  "cfg_tipo_relacion_articulo",
  "cfg_tipo_tope",
  "cfg_unidad_medida_articulo",
  "cfg_unidad_minima_consumo",
  "cfg_unidad_plazo",
  "cfg_ambito_consumo",
  "cfg_justifica_sueldo",
]);

/** Ítems para {@link SECCIONES_CATALOGO_RRHH} — `soloLectura: true` evita alta/edición destructiva vía callable genérico. */
export const ITEMS_CATALOGO_ARTICULOS_V2 = Object.freeze(
  COLECCIONES_FIRESTORE_ARTICULOS_V2.map((collectionName) => ({
    key: `art2_${collectionName}`,
    etiqueta: etiquetaDesdeNombre(collectionName),
    collectionName,
    idPrefix: "CFG_",
    soloLectura: true,
  })),
);
