/**
 * Contrato documento `solicitudes_articulo` — unión por `schema_version` (create cliente).
 * @see docs/v2/RFC_TICKETERA_SLICE_MEDICO_CAJA_NEGRA_V2.md §2.2
 * @see web/src/schemas/solicitudArticuloCreate.schema.js — Patrón B/C borrador
 */

import { z } from "zod";

import {
  ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA,
  PATRON_SALDO_MEDICO_AVISO,
  SCHEMA_SOLICITUD_MED_AVISO,
  SCHEMA_SOLICITUD_PATRON_B,
  SCHEMA_SOLICITUD_PATRON_C,
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
} from "../constants/solicitudesArticuloV2.js";
import {
  solicitudArticuloCreateShapePatronBSchema,
  solicitudArticuloCreateShapePatronCSchema,
} from "./solicitudArticuloCreate.schema.js";

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

const perIdSchema = z.string().regex(new RegExp(`^per_${ULID}$`, "i"));
const gdtIdSchema = z.string().regex(new RegExp(`^gdt_${ULID}$`, "i"));
const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cfgTigIdSchema = z.enum([
  TIPO_INGRESO_MEDICO_ENFERMEDAD_PROPIA,
  TIPO_INGRESO_MEDICO_ATENCION_FAMILIAR,
]);

const ingresoMedicoAdjuntoSchema = z
  .object({
    storage_path: z.string().min(1).max(1024),
    content_type: z.string().max(128).optional(),
    nombre_archivo: z.string().max(256).optional(),
  })
  .strict();

const ingresoMedicoCajaNegraSchema = z
  .object({
    modo: z.literal("caja_negra"),
    tipo_ingreso_id: cfgTigIdSchema,
    adjuntos: z.array(ingresoMedicoAdjuntoSchema).min(1).max(10),
    comentario_agente: z.string().max(2000).optional(),
  })
  .strict();

/** Parámetros UI — aviso médico antes de clasificación auditor. */
export const solicitudMedAvisoAltaInputSchema = z
  .object({
    personaId: perIdSchema,
    tipoIngresoId: cfgTigIdSchema,
    grupoTrabajoIdAncla: gdtIdSchema,
    fechaInicioReposoEstimada: ymdSchema.optional(),
    adjuntos: z.array(ingresoMedicoAdjuntoSchema).min(1).max(10),
    comentarioAgente: z.string().max(2000).optional(),
  })
  .strict();

/**
 * Documento create aviso Caja Negra (`articulo_id` null hasta clasificación).
 * Sin `onSolicitudArticuloPatronBOnCreate` — shape distinto al borrador B/C.
 */
export const solicitudArticuloCreateShapeMedAvisoSchema = z
  .object({
    schema_version: z.literal(SCHEMA_SOLICITUD_MED_AVISO),
    articulo_id: z.null(),
    version_id_aplicada: z.null(),
    titular_persona_id: perIdSchema,
    actor_alta_persona_id: perIdSchema,
    grupo_trabajo_id_ancla: gdtIdSchema,
    patron_saldo: z.literal(PATRON_SALDO_MEDICO_AVISO),
    estado_solicitud_id: z.literal(ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA),
    ingreso_medico: ingresoMedicoCajaNegraSchema,
    fecha_inicio_reposo_estimada: ymdSchema.optional(),
    creado_en: z.unknown(),
    actualizado_en: z.unknown(),
  })
  .strict();

/**
 * @param {z.infer<typeof solicitudMedAvisoAltaInputSchema>} input
 * @param {{ creado_en: unknown, actualizado_en: unknown }} timestamps
 */
export function buildSolicitudMedAvisoDocument(input, timestamps) {
  const parsed = solicitudMedAvisoAltaInputSchema.parse(input);
  const ingreso = {
    modo: "caja_negra",
    tipo_ingreso_id: parsed.tipoIngresoId,
    adjuntos: parsed.adjuntos,
  };
  if (parsed.comentarioAgente) {
    ingreso.comentario_agente = parsed.comentarioAgente;
  }
  const doc = {
    schema_version: SCHEMA_SOLICITUD_MED_AVISO,
    articulo_id: null,
    version_id_aplicada: null,
    titular_persona_id: parsed.personaId,
    actor_alta_persona_id: parsed.personaId,
    grupo_trabajo_id_ancla: parsed.grupoTrabajoIdAncla,
    patron_saldo: PATRON_SALDO_MEDICO_AVISO,
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_PENDIENTE_CLASIFICACION_MEDICA,
    ingreso_medico: ingreso,
    creado_en: timestamps.creado_en,
    actualizado_en: timestamps.actualizado_en,
  };
  if (parsed.fechaInicioReposoEstimada) {
    doc.fecha_inicio_reposo_estimada = parsed.fechaInicioReposoEstimada;
  }
  return solicitudArticuloCreateShapeMedAvisoSchema.parse(doc);
}

/**
 * Unión por `schema_version` (discriminador lógico).
 * Patrón B usa `.refine()` — no es `ZodObject` plano; por eso `z.union` y no `discriminatedUnion`.
 */
export const solicitudArticuloCreateDocumentSchema = z.union([
  solicitudArticuloCreateShapePatronBSchema,
  solicitudArticuloCreateShapePatronCSchema,
  solicitudArticuloCreateShapeMedAvisoSchema,
]);

export function parseSolicitudArticuloCreateDocument(doc) {
  return solicitudArticuloCreateDocumentSchema.parse(doc);
}
