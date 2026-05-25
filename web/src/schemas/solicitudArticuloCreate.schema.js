/**
 * Contrato create cliente — `solicitudes_articulo` Patrón B + C (Bloque A).
 * @see docs/v2/TICKETERA_EVIDENCIA_2026-05-21_CREATE_PATRON_B.md
 * @see firebase-v2/firestore.rules — solicitudArticuloCreateShapePatronB / PatronC
 */

import { z } from "zod";

import {
  ESTADO_SOLICITUD_ARTICULO_BORRADOR,
  SCHEMA_SOLICITUD_PATRON_B,
  SCHEMA_SOLICITUD_PATRON_C,
} from "../constants/solicitudesArticuloV2.js";

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

const artIdSchema = z.string().regex(new RegExp(`^art_${ULID}$`, "i"));
const perIdSchema = z.string().regex(new RegExp(`^per_${ULID}$`, "i"));
const verIdSchema = z.string().regex(new RegExp(`^ver_${ULID}$`, "i"));
const gdtIdSchema = z.string().regex(new RegExp(`^gdt_${ULID}$`, "i"));
const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Parámetros de alta desde UI / hook (antes de timestamps Firestore). */
export const solicitudPatronBAltaInputSchema = z
  .object({
    personaId: perIdSchema,
    articuloId: artIdSchema,
    versionIdAplicada: verIdSchema,
    fechaDesde: ymdSchema,
    diasSolicitados: z.number().int().min(1).max(31),
    grupoTrabajoIdAncla: gdtIdSchema,
  })
  .strict();

/**
 * Documento borrador Patrón B (claves permitidas en Rules + setDoc).
 * `creado_en` / `actualizado_en`: FieldValue en runtime (no validados aquí).
 */
export const solicitudArticuloCreateShapePatronBSchema = z
  .object({
    articulo_id: artIdSchema,
    titular_persona_id: perIdSchema,
    actor_alta_persona_id: perIdSchema,
    version_id_aplicada: verIdSchema,
    fecha_desde: ymdSchema,
    fecha_hasta: ymdSchema,
    anio_ciclo_consumo: z.number().int().min(1900).max(2200),
    dias_solicitados: z.number().int().min(1).max(31),
    patron_saldo: z.literal("B"),
    estado_solicitud_id: z.literal(ESTADO_SOLICITUD_ARTICULO_BORRADOR),
    schema_version: z.literal(SCHEMA_SOLICITUD_PATRON_B),
    grupo_trabajo_id_ancla: gdtIdSchema,
    creado_en: z.unknown(),
    actualizado_en: z.unknown(),
  })
  .strict()
  .refine((d) => d.fecha_hasta === d.fecha_desde, {
    message: "fecha_hasta debe ser igual a fecha_desde (MVP 1 día/evento).",
    path: ["fecha_hasta"],
  })
  .refine((d) => d.anio_ciclo_consumo === Number(d.fecha_desde.slice(0, 4)), {
    message: "anio_ciclo_consumo debe coincidir con el año de fecha_desde.",
    path: ["anio_ciclo_consumo"],
  });

/**
 * @param {z.infer<typeof solicitudPatronBAltaInputSchema>} input
 * @param {{ creado_en: unknown, actualizado_en: unknown }} timestamps
 */
export function buildSolicitudPatronBBorradorDocument(input, timestamps) {
  const parsed = solicitudPatronBAltaInputSchema.parse(input);
  const fechaDesde = parsed.fechaDesde;
  const doc = {
    articulo_id: parsed.articuloId,
    titular_persona_id: parsed.personaId,
    actor_alta_persona_id: parsed.personaId,
    version_id_aplicada: parsed.versionIdAplicada,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaDesde,
    anio_ciclo_consumo: Number(fechaDesde.slice(0, 4)),
    dias_solicitados: parsed.diasSolicitados,
    patron_saldo: "B",
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_BORRADOR,
    schema_version: SCHEMA_SOLICITUD_PATRON_B,
    grupo_trabajo_id_ancla: parsed.grupoTrabajoIdAncla,
    creado_en: timestamps.creado_en,
    actualizado_en: timestamps.actualizado_en,
  };
  return solicitudArticuloCreateShapePatronBSchema.parse(doc);
}

// ---------------------------------------------------------------------------
// Patrón C — Cuenta corriente continua (horas, saldo global)
// ---------------------------------------------------------------------------

/** Parámetros de alta Patrón C desde UI / hook. */
export const solicitudPatronCAltaInputSchema = z
  .object({
    personaId: perIdSchema,
    articuloId: artIdSchema,
    versionIdAplicada: verIdSchema,
    fechaDesde: ymdSchema,
    fechaHasta: ymdSchema,
    horasSolicitadas: z.number().positive(),
    grupoTrabajoIdAncla: gdtIdSchema,
  })
  .strict();

/**
 * Documento borrador Patrón C (claves permitidas en Rules + setDoc).
 * Sin anio_ciclo_consumo (saldo global interanual).
 */
export const solicitudArticuloCreateShapePatronCSchema = z
  .object({
    articulo_id: artIdSchema,
    titular_persona_id: perIdSchema,
    actor_alta_persona_id: perIdSchema,
    version_id_aplicada: verIdSchema,
    fecha_desde: ymdSchema,
    fecha_hasta: ymdSchema,
    horas_solicitadas: z.number().positive(),
    patron_saldo: z.literal("C"),
    estado_solicitud_id: z.literal(ESTADO_SOLICITUD_ARTICULO_BORRADOR),
    schema_version: z.literal(SCHEMA_SOLICITUD_PATRON_C),
    grupo_trabajo_id_ancla: gdtIdSchema,
    creado_en: z.unknown(),
    actualizado_en: z.unknown(),
  })
  .strict();

/**
 * @param {z.infer<typeof solicitudPatronCAltaInputSchema>} input
 * @param {{ creado_en: unknown, actualizado_en: unknown }} timestamps
 */
export function buildSolicitudPatronCBorradorDocument(input, timestamps) {
  const parsed = solicitudPatronCAltaInputSchema.parse(input);
  const doc = {
    articulo_id: parsed.articuloId,
    titular_persona_id: parsed.personaId,
    actor_alta_persona_id: parsed.personaId,
    version_id_aplicada: parsed.versionIdAplicada,
    fecha_desde: parsed.fechaDesde,
    fecha_hasta: parsed.fechaHasta,
    horas_solicitadas: parsed.horasSolicitadas,
    patron_saldo: "C",
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_BORRADOR,
    schema_version: SCHEMA_SOLICITUD_PATRON_C,
    grupo_trabajo_id_ancla: parsed.grupoTrabajoIdAncla,
    creado_en: timestamps.creado_en,
    actualizado_en: timestamps.actualizado_en,
  };
  return solicitudArticuloCreateShapePatronCSchema.parse(doc);
}
