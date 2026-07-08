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
import { cie10SolicitudMapSchema, cfgCldIdSchema, TOPE_DIAS_LICENCIA_MEDICA_LARGA } from "./solicitudMedLargaCie10.schema.js";

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

const artIdSchema = z.string().regex(new RegExp(`^art_${ULID}$`, "i"));
const perIdSchema = z.string().regex(new RegExp(`^per_${ULID}$`, "i"));
const verIdSchema = z.string().regex(new RegExp(`^ver_${ULID}$`, "i"));
const gdtIdSchema = z.string().regex(new RegExp(`^gdt_${ULID}$`, "i"));
const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const opcionConsumoIdSchema = z
  .string()
  .regex(/^oc_[a-z0-9_]+$/i, "opcion_consumo_id estable oc_*");

/** Parámetros de alta desde UI / hook (antes de timestamps Firestore). */
export const solicitudPatronBAltaInputSchema = z
  .object({
    personaId: perIdSchema,
    articuloId: artIdSchema,
    versionIdAplicada: verIdSchema,
    fechaDesde: ymdSchema,
    fechaHasta: ymdSchema.optional(),
    diasSolicitados: z.number().int().min(1).max(TOPE_DIAS_LICENCIA_MEDICA_LARGA),
    grupoTrabajoIdAncla: gdtIdSchema,
    opcionConsumoId: opcionConsumoIdSchema.optional(),
    causalLargaDuracionId: cfgCldIdSchema.optional(),
    cie10: z
      .object({
        codigo: z.string().min(2).max(12),
        descripcion: z.string().min(3).max(500),
      })
      .strict()
      .optional(),
    /** CAMBIO-DIA — traslado propio (Etapa 1). */
    esCambioDia: z.boolean().optional(),
    fechaOrigen: ymdSchema.optional(),
    fechaDestino: ymdSchema.optional(),
    motivo: z.string().min(3).max(500).optional(),
    tomaConocimientoAgente: z.boolean().optional(),
    tomaConocimientoTexto: z.string().min(20).max(2000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.esCambioDia === true) {
      if (!data.fechaOrigen || !data.fechaDestino || !data.motivo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechaOrigen"],
          message: "CAMBIO-DIA requiere fechaOrigen, fechaDestino y motivo.",
        });
        return;
      }
      if (data.tomaConocimientoAgente !== true || !data.tomaConocimientoTexto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tomaConocimientoAgente"],
          message: "Debés aceptar la toma de conocimiento antes de enviar.",
        });
        return;
      }
      if (data.fechaOrigen === data.fechaDestino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fechaDestino"],
          message: "El día destino debe ser distinto del día origen.",
        });
      }
      if (data.diasSolicitados !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diasSolicitados"],
          message: "CAMBIO-DIA: diasSolicitados debe ser 1.",
        });
      }
      return;
    }
    const esLarga = Boolean(data.causalLargaDuracionId && data.cie10);
    if (esLarga) {
      if (data.diasSolicitados > TOPE_DIAS_LICENCIA_MEDICA_LARGA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diasSolicitados"],
          message: "Licencia larga: excede tope de episodio.",
        });
      }
      return;
    }
    if (data.diasSolicitados > 31) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diasSolicitados"],
        message: "Patrón B estándar: máximo 31 días por solicitud.",
      });
    }
    if (data.causalLargaDuracionId || data.cie10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["causalLargaDuracionId"],
        message: "Licencia larga requiere causal Art. 19 y CIE-10.",
      });
    }
  });

const solicitudPatronBShapeBaseSchema = z
  .object({
    articulo_id: artIdSchema,
    titular_persona_id: perIdSchema,
    actor_alta_persona_id: perIdSchema,
    version_id_aplicada: verIdSchema,
    fecha_desde: ymdSchema,
    fecha_hasta: ymdSchema,
    anio_ciclo_consumo: z.number().int().min(1900).max(2200),
    dias_solicitados: z.number().int().min(1).max(TOPE_DIAS_LICENCIA_MEDICA_LARGA),
    patron_saldo: z.literal("B"),
    estado_solicitud_id: z.literal(ESTADO_SOLICITUD_ARTICULO_BORRADOR),
    schema_version: z.literal(SCHEMA_SOLICITUD_PATRON_B),
    grupo_trabajo_id_ancla: gdtIdSchema,
    opcion_consumo_id: opcionConsumoIdSchema.optional(),
    causal_larga_duracion_id: cfgCldIdSchema.optional(),
    cie10: cie10SolicitudMapSchema.optional(),
    fecha_origen: ymdSchema.optional(),
    fecha_destino: ymdSchema.optional(),
    motivo: z.string().min(3).max(500).optional(),
    es_cambio_dia: z.literal(true).optional(),
    cambio_dia_schema: z.literal("CAMBIO_DIA_V1").optional(),
    toma_conocimiento_agente: z.literal(true).optional(),
    toma_conocimiento_texto: z.string().min(20).max(2000).optional(),
    creado_en: z.unknown(),
    actualizado_en: z.unknown(),
  })
  .strict();

/**
 * Documento borrador Patrón B (claves permitidas en Rules + setDoc).
 * `creado_en` / `actualizado_en`: FieldValue en runtime (no validados aquí).
 */
export const solicitudArticuloCreateShapePatronBSchema = solicitudPatronBShapeBaseSchema
  .refine(
    (d) =>
      d.dias_solicitados > 1 ||
      d.opcion_consumo_id != null ||
      d.fecha_hasta === d.fecha_desde,
    {
      message:
        "fecha_hasta debe ser igual a fecha_desde salvo multi-día u opción de consumo.",
      path: ["fecha_hasta"],
    },
  )
  .refine((d) => d.fecha_hasta >= d.fecha_desde, {
    message: "fecha_hasta no puede ser anterior a fecha_desde.",
    path: ["fecha_hasta"],
  })
  .refine((d) => d.anio_ciclo_consumo === Number(d.fecha_desde.slice(0, 4)), {
    message: "anio_ciclo_consumo debe coincidir con el año de fecha_desde.",
    path: ["anio_ciclo_consumo"],
  })
  .superRefine((d, ctx) => {
    if (d.es_cambio_dia === true) {
      if (
        !d.fecha_origen ||
        !d.fecha_destino ||
        !d.motivo ||
        d.cambio_dia_schema !== "CAMBIO_DIA_V1" ||
        d.toma_conocimiento_agente !== true ||
        !d.toma_conocimiento_texto
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["es_cambio_dia"],
          message: "CAMBIO-DIA incompleto en el documento borrador (incluye toma de conocimiento).",
        });
        return;
      }
      if (d.fecha_origen === d.fecha_destino) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_destino"],
          message: "Origen y destino deben diferir.",
        });
      }
      if (d.fecha_desde !== d.fecha_origen || d.fecha_hasta !== d.fecha_origen) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fecha_desde"],
          message: "En CAMBIO-DIA, fecha_desde/hasta anclan al día origen.",
        });
      }
      if (d.dias_solicitados !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dias_solicitados"],
          message: "CAMBIO-DIA usa dias_solicitados = 1.",
        });
      }
      return;
    }
    const esLarga = Boolean(d.causal_larga_duracion_id && d.cie10);
    if (esLarga) {
      if (d.dias_solicitados > TOPE_DIAS_LICENCIA_MEDICA_LARGA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dias_solicitados"],
          message: "Excede tope episodio larga.",
        });
      }
      return;
    }
    if (d.dias_solicitados > 31) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dias_solicitados"],
        message: "Máximo 31 días en Patrón B estándar.",
      });
    }
    if (d.causal_larga_duracion_id || d.cie10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["causal_larga_duracion_id"],
        message: "Faltan causal o CIE-10 para licencia larga.",
      });
    }
  });

/**
 * @param {z.infer<typeof solicitudPatronBAltaInputSchema>} input
 * @param {{ creado_en: unknown, actualizado_en: unknown }} timestamps
 */
export function buildSolicitudPatronBBorradorDocument(input, timestamps) {
  const parsed = solicitudPatronBAltaInputSchema.parse(input);
  const esCambioDia = parsed.esCambioDia === true;
  const fechaDesde = esCambioDia ? parsed.fechaOrigen : parsed.fechaDesde;
  const fechaHasta = esCambioDia
    ? parsed.fechaOrigen
    : parsed.fechaHasta && parsed.fechaHasta >= fechaDesde
      ? parsed.fechaHasta
      : fechaDesde;
  const doc = {
    articulo_id: parsed.articuloId,
    titular_persona_id: parsed.personaId,
    actor_alta_persona_id: parsed.personaId,
    version_id_aplicada: parsed.versionIdAplicada,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    anio_ciclo_consumo: Number(fechaDesde.slice(0, 4)),
    dias_solicitados: esCambioDia ? 1 : parsed.diasSolicitados,
    patron_saldo: "B",
    estado_solicitud_id: ESTADO_SOLICITUD_ARTICULO_BORRADOR,
    schema_version: SCHEMA_SOLICITUD_PATRON_B,
    grupo_trabajo_id_ancla: parsed.grupoTrabajoIdAncla,
    creado_en: timestamps.creado_en,
    actualizado_en: timestamps.actualizado_en,
  };
  if (esCambioDia) {
    doc.fecha_origen = parsed.fechaOrigen;
    doc.fecha_destino = parsed.fechaDestino;
    doc.motivo = parsed.motivo;
    doc.es_cambio_dia = true;
    doc.cambio_dia_schema = "CAMBIO_DIA_V1";
    doc.toma_conocimiento_agente = true;
    doc.toma_conocimiento_texto = parsed.tomaConocimientoTexto;
  }
  if (parsed.opcionConsumoId) {
    doc.opcion_consumo_id = parsed.opcionConsumoId;
  }
  if (parsed.causalLargaDuracionId && parsed.cie10) {
    doc.causal_larga_duracion_id = parsed.causalLargaDuracionId;
    doc.cie10 = cie10SolicitudMapSchema.parse({
      codigo: parsed.cie10.codigo,
      descripcion: parsed.cie10.descripcion,
      fecha_imputacion: timestamps.creado_en,
    });
  }
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
