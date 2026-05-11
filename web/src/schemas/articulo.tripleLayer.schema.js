/**
 * Schemas triple capa — saldos (contable) y vistas (gestión).
 * Basado en docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md §2.5 y §8.
 *
 * Objetivo: lecturas acotadas en grilla; sincronía solicitud → saldos → vista vía Cloud Functions.
 */

import { z } from "zod";
import {
  artDocumentIdSchema,
  perDocumentIdSchema,
  cfgRowIdSchema,
  firestoreDateLikeSchema,
  solDocumentIdSchema,
} from "./articulo.schema.js";

const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";

/** Id documento capa contable: `sal_<YYYY>_per_<ULID>`. */
export const salDocumentIdSchema = z
  .string()
  .regex(new RegExp(`^sal_\\d{4}_per_${ULID_RE}$`));

/** Id documento capa vista: `vis_<YYYY>_<MM>_per_<ULID>` (mes 01–12). */
export const visDocumentIdSchema = z
  .string()
  .regex(new RegExp(`^vis_\\d{4}_(0[1-9]|1[0-2])_per_${ULID_RE}$`));

/**
 * Una "bolsa" de crédito (LAO año, Art. 68, 70 bis, etc.).
 * `disponible` lo mantiene la Function (inicial − consumido) para lectura O(1).
 */
export const bolsaSaldoSchema = z
  .object({
    bolsa_id: z.string().min(1),
    articulo_id: artDocumentIdSchema,
    /** Denormalizado para UI sin join a versión. */
    codigo_grilla: z.string(),
    anio_origen: z.number().int(),
    cantidad_inicial: z.number().nonnegative(),
    consumido: z.number().nonnegative().default(0),
    disponible: z.number(),
    fecha_vencimiento: firestoreDateLikeSchema.nullable().optional(),
    es_arrastre: z.boolean().default(false),
    origen_saldo_id: cfgRowIdSchema,
    ultima_actualizacion: firestoreDateLikeSchema,
  })
  .strict();

/** Colección `saldos_articulo_agente` — un documento por (persona_id, año). */
export const saldosArticuloAgenteSchema = z
  .object({
    persona_id: perDocumentIdSchema,
    anio_calendario: z.number().int(),
    /** Clave = `bolsa_id` (acceso O(1)). */
    bolsas: z.record(z.string(), bolsaSaldoSchema),
    metadata: z
      .object({
        ultima_sincronizacion: firestoreDateLikeSchema,
        hash_verificacion: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const hexColorSchema = z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);

/** Evento de licencia/franquicia en un día (capa operativa enlazada). */
export const eventoDiaSchema = z
  .object({
    solicitud_id: solDocumentIdSchema,
    articulo_id: artDocumentIdSchema,
    codigo_grilla: z.string(),
    color_ui: hexColorSchema,
    nivel_ocupacion_dia_id: cfgRowIdSchema,
    estado_solicitud_id: cfgRowIdSchema,
  })
  .strict();

/** Un día del mes en la grilla (RDA + eventos; multievento según nivel_ocupacion). */
export const diaGrillaSchema = z
  .object({
    rda_turno_id: cfgRowIdSchema.nullable().optional(),
    eventos: z.array(eventoDiaSchema).default([]),
    tiene_conflicto: z.boolean().default(false),
    es_franco: z.boolean().default(false),
  })
  .strict();

const diaMesKeySchema = z.string().regex(/^(0[1-9]|[12][0-9]|3[01])$/);

const resumenSaldoMesEntrySchema = z
  .object({
    codigo: z.string(),
    disponible: z.number(),
  })
  .strict();

/** Colección `vistas_grilla_mes_agente` — un documento por (persona_id, año, mes). */
export const vistasGrillaMesAgenteSchema = z
  .object({
    persona_id: perDocumentIdSchema,
    anio: z.number().int(),
    mes: z.number().int().min(1).max(12),
    /** Clave = día "01"…"31" (mes parcial permitido). */
    dias: z.record(diaMesKeySchema, diaGrillaSchema),
    resumen_saldos_mes: z.record(z.string(), resumenSaldoMesEntrySchema),
    metadata: z
      .object({
        generado_en: firestoreDateLikeSchema,
        depende_rda: z.boolean().default(true),
      })
      .strict(),
  })
  .strict();

export const saldosArticuloAgenteWithIdSchema = saldosArticuloAgenteSchema.extend({
  id: salDocumentIdSchema.optional(),
});

export const vistasGrillaMesAgenteWithIdSchema = vistasGrillaMesAgenteSchema.extend({
  id: visDocumentIdSchema.optional(),
});

/** @typedef {import("zod").infer<typeof bolsaSaldoSchema>} BolsaSaldo */
/** @typedef {import("zod").infer<typeof saldosArticuloAgenteSchema>} SaldoAgenteAnual */
/** @typedef {import("zod").infer<typeof eventoDiaSchema>} EventoDiaGrilla */
/** @typedef {import("zod").infer<typeof diaGrillaSchema>} DiaGrilla */
/** @typedef {import("zod").infer<typeof vistasGrillaMesAgenteSchema>} VistaAgenteMensual */

export const ARTICULO_TRIPLE_LAYER_SCHEMA_VERSION = "v2-triple-layer-2026-05";
