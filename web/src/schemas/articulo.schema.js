/**
 * Schema Zod — Artículos V2 (triple capa, product-first).
 * Contrato: docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md
 *
 * - Núcleo `cfg_articulos` (identidad estable, §2.1).
 * - `versiones/{ver_id}`: parámetros embebidos acotados; **excluye** arrays que viven en subcolecciones (§1.7).
 * - `cfg_articulo_relaciones` (grafo, §2.3).
 *
 * Tipos inferidos: `ArticuloCore`, `ArticuloVersion`, `ArticuloRelacion` (JSDoc al final).
 */

import { z } from "zod";

/** Crockford base32 ULID (26 chars). */
const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";

export const artDocumentIdSchema = z.string().regex(new RegExp(`^art_${ULID_RE}$`));
export const verDocumentIdSchema = z.string().regex(new RegExp(`^ver_${ULID_RE}$`));
export const carDocumentIdSchema = z.string().regex(new RegExp(`^car_${ULID_RE}$`));
export const perDocumentIdSchema = z.string().regex(new RegExp(`^per_${ULID_RE}$`));

/** Referencia a fila de catálogo cfg_* (id de documento). */
const cfgRowIdSchema = z.string().min(1);

/** Timestamp Firestore, ISO o Date según capa cliente/Functions. */
const firestoreDateLikeSchema = z.union([z.string(), z.date(), z.any()]);

// --- Bloques embebidos en la versión (§4) — sin arrays §1.7 ---

const normativaHabilitanteSchema = z
  .object({
    decreto: z.string().nullable().optional(),
    resolucion: z.string().nullable().optional(),
    interno_efector: z.string().nullable().optional(),
  })
  .strict();

const visualizacionSchema = z
  .object({
    /** Texto en celda mensual (capa Vista). */
    codigo_grilla: z.string().max(48).nullable().optional(),
    /** Color de fondo de celda (capa Vista). */
    color_ui: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullable()
      .optional(),
  })
  .strict();

/** Bloque 1 — Identidad y naturaleza (incl. visualización de grilla). */
export const bloqueIdentidadNaturalezaSchema = z
  .object({
    codigo: z.string().min(1),
    inciso_normativo: z.string().min(1),
    nombre: z.string().min(1),
    normativa_habilitante: normativaHabilitanteSchema.optional(),
    es_lao_anual: z.boolean().default(false),
    es_sancion: z.boolean().default(false),
    es_inasistencia: z.boolean().default(false),
    es_sin_goce: z.boolean().default(false),
    requiere_dictamen: z.boolean().default(false),
    visualizacion: visualizacionSchema.optional(),
  })
  .strict();

/** Bloque 2 — Impacto económico y carrera. */
export const bloqueImpactoEconomicoSchema = z
  .object({
    justifica_sueldo_id: cfgRowIdSchema,
    suma_para_sac: z.boolean().default(false),
    afecta_presentismo: z.boolean().default(false),
    acumula_reparto_obra_social: z.boolean().default(false),
    invalida_reparto_obra_social: z.boolean().default(false),
    suma_antiguedad_lao: z.boolean().default(false),
  })
  .strict();

/**
 * Bloque 3 — Elegibilidad (solo escalares en el doc de versión).
 * filtros_personales[], filtros_antiguedad[], filtros_hlc[], filtros_hlg[] → subcolecciones (§1.7).
 */
export const bloqueElegibilidadFiltrosSchema = z
  .object({
    requiere_declaracion_familiar: z.boolean().default(false),
    edad_limite_familiar: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

/**
 * Bloque 4 — Topes, plazos y cómputo (motor saldos / RDA para Cloud Functions).
 * `topes[]` excluido del documento principal (§1.7).
 */
export const bloqueTopesPlazosComputoSchema = z
  .object({
    regla_computo_dias_id: cfgRowIdSchema,
    ambito_consumo_id: cfgRowIdSchema,
    fraccionamiento_habilitado: z.boolean().default(false),
    intervalo_gracia_dias: z.number().int().nonnegative().default(0),
    regla_computo_horas_id: cfgRowIdSchema.nullable().optional(),
    reinicio_ciclo_id: cfgRowIdSchema,
    depende_rda: z.boolean().default(false),
    accion_saldo_id: cfgRowIdSchema,
    origen_saldo_id: cfgRowIdSchema,
  })
  .strict();

/**
 * Bloque 5 — Acumulación y sucesión.
 * `meses_arrastre` alimenta lógica de saldo/vista mensual (Art. 70 bis, etc.).
 */
export const bloqueAcumulacionSucesionSchema = z
  .object({
    caducidad_tipo_id: cfgRowIdSchema,
    caducidad_limite_meses: z.number().int().nonnegative().nullable().optional(),
    permite_prorroga: z.boolean().default(false),
    prorroga_articulo_relacion_id: carDocumentIdSchema.nullable().optional(),
    meses_arrastre: z.number().int().nonnegative().default(0),
  })
  .strict();

/**
 * Bloque 6 — Workflow / SLA (solo escalares en el doc).
 * ingreso_permitido_por_rol_ids[], pasos_aprobacion[], sla_por_paso[] → subcolecciones (§1.7).
 */
export const bloqueWorkflowSlaCoberturaSchema = z
  .object({
    plazo_preaviso_normativa_dias: z.number().int().nonnegative().nullable().optional(),
    plazo_preaviso_interno_dias: z.number().int().nonnegative().nullable().optional(),
    logistica_aviso_habilitada: z.boolean().default(false),
    toma_conocimiento_limitada: z.boolean().default(false),
  })
  .strict();

/**
 * Bloque 7 — Documentación y convivencia intradía.
 * articulos_incompatibles_ids[] / articulos_compatibles_ids[] → grafo cfg_articulo_relaciones (§1.7).
 */
export const bloqueDocumentacionConvivenciaSchema = z
  .object({
    requiere_doc_previa: z.boolean().default(false),
    plazo_doc_previa_dias: z.number().int().nonnegative().nullable().optional(),
    requiere_doc_posterior: z.boolean().default(false),
    plazo_doc_posterior_dias: z.number().int().nonnegative().nullable().optional(),
    accion_incumplimiento_doc_id: cfgRowIdSchema,
    nivel_ocupacion_dia_id: cfgRowIdSchema,
  })
  .strict();

// --- Núcleo cfg_articulos (§2.1) ---

export const cfgArticuloCoreSchema = z
  .object({
    codigo: z.string().min(1),
    inciso_normativo: z.string().min(1),
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    origen_normativo_id: cfgRowIdSchema,
    es_lao_anual: z.boolean().default(false),
    es_sancion: z.boolean().default(false),
    es_inasistencia: z.boolean().default(false),
    es_sin_goce: z.boolean().default(false),
    requiere_dictamen: z.boolean().default(false),
    activo: z.boolean(),
    estado_articulo_id: cfgRowIdSchema,
    vigente_desde: firestoreDateLikeSchema.nullable().optional(),
    vigente_hasta: firestoreDateLikeSchema.nullable().optional(),
    version_actual_id: verDocumentIdSchema,
  })
  .strict();

// --- Documento de versión (§2.2 + §4 vía bloques) ---

export const cfgArticuloVersionSchema = z
  .object({
    version_semantica: z.string().min(1),
    estado_version_id: cfgRowIdSchema,
    publicada_en: firestoreDateLikeSchema.nullable().optional(),
    publicada_por_persona_id: perDocumentIdSchema.nullable().optional(),
    bloque_identidad_naturaleza: bloqueIdentidadNaturalezaSchema,
    bloque_impacto_economico: bloqueImpactoEconomicoSchema,
    bloque_elegibilidad_filtros: bloqueElegibilidadFiltrosSchema,
    bloque_topes_plazos_computo: bloqueTopesPlazosComputoSchema,
    bloque_acumulacion_sucesion: bloqueAcumulacionSucesionSchema,
    bloque_workflow_sla_cobertura: bloqueWorkflowSlaCoberturaSchema,
    bloque_documentacion_convivencia: bloqueDocumentacionConvivenciaSchema,
  })
  .strict();

// --- Grafo cfg_articulo_relaciones (§2.3) ---

export const cfgArticuloRelacionesSchema = z
  .object({
    articulo_origen_id: artDocumentIdSchema,
    articulo_destino_id: artDocumentIdSchema,
    tipo_relacion_id: cfgRowIdSchema,
    condicion_relacion: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
    prioridad: z.number().int().default(0),
    activo: z.boolean(),
    vigente_desde: firestoreDateLikeSchema.nullable().optional(),
    vigente_hasta: firestoreDateLikeSchema.nullable().optional(),
  })
  .strict();

export const articuloIdSchemas = {
  artDocumentIdSchema,
  verDocumentIdSchema,
  carDocumentIdSchema,
  perDocumentIdSchema,
};

export const cfgArticuloCoreWithIdSchema = cfgArticuloCoreSchema.extend({
  id: artDocumentIdSchema.optional(),
});

export const cfgArticuloVersionWithIdSchema = cfgArticuloVersionSchema.extend({
  id: verDocumentIdSchema.optional(),
});

export const cfgArticuloRelacionWithIdSchema = cfgArticuloRelacionesSchema.extend({
  id: carDocumentIdSchema.optional(),
});

/** @typedef {import("zod").infer<typeof cfgArticuloCoreSchema>} ArticuloCore */
/** @typedef {import("zod").infer<typeof cfgArticuloVersionSchema>} ArticuloVersion */
/** @typedef {import("zod").infer<typeof cfgArticuloRelacionesSchema>} ArticuloRelacion */

export const ARTICULO_SCHEMA_VERSION = "v2-triple-layer-2026-05";
