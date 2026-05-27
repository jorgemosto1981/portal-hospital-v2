/**
 * Schema Zod — Capa teórica segmentada V2
 * Contrato: docs/v2/CAPA_TEORICA_SEGMENTOS_V2.md
 * Espejo backend: functions/modules/asistencia/schemas/capaTeoricaSegmentos.contract.js
 */
import { z } from "zod";
import { cfgCdcIdSchema, cfgTccIdSchema, cfgTovIdSchema } from "./cfgAsistenciaTurnos.schema.js";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
const PER_ID = /^per_[A-Z0-9]+$/i;

export const ORIGEN_SEGMENTO = /** @type {const} */ ([
  "plan_base",
  "override_cobertura",
  "licencia_ajuste",
]);
export const TIPO_DIA_OPERATIVO = /** @type {const} */ ([
  "laborable",
  "franco",
  "guardia",
  "no_laborable",
]);
export const PATRON_FICHADA = /** @type {const} */ (["egreso", "ingreso"]);
export const TIPO_EXPECTATIVA_FICHADA = /** @type {const} */ (["salida_momentanea"]);

/** @typedef {z.infer<typeof segmentoTeoricoSchema>} SegmentoTurno */
export const segmentoTeoricoSchema = z
  .object({
    segmento_id: z.string().min(1),
    ingreso_iso: z.string().regex(ISO_DT),
    egreso_iso: z.string().regex(ISO_DT),
    fecha_base: z.string().regex(YMD),
    fecha_fin_real: z.string().regex(YMD).optional(),
    cruza_medianoche: z.boolean().default(false),
    persona_titular_id: z.string().regex(PER_ID),
    persona_ejecutante_id: z.string().regex(PER_ID),
    origen_segmento: z.enum(ORIGEN_SEGMENTO),
    tipo_compensacion_id: cfgTccIdSchema.nullable().optional(),
    flags_liquidacion: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

/** @typedef {z.infer<typeof resumenOperativoDerivadoSchema>} ResumenOperativoDerivado */
export const resumenOperativoDerivadoSchema = z
  .object({
    ingreso_teorico_final: z.string().regex(ISO_DT).nullable(),
    egreso_teorico_final: z.string().regex(ISO_DT).nullable(),
    horas_teoricas_totales: z.number().min(0).max(48),
    turno_compuesto_id: z.string().min(1).nullable(),
    tiene_huecos: z.boolean(),
  })
  .strict();

/** @typedef {z.infer<typeof expectativaFichadaExtraSchema>} ExpectativaFichadaExtra */
export const expectativaFichadaExtraSchema = z
  .object({
    tipo: z.enum(TIPO_EXPECTATIVA_FICHADA),
    fecha_base: z.string().regex(YMD),
    cantidad_fichadas_esperadas: z.number().int().min(1).max(20),
    patron_esperado: z.array(z.enum(PATRON_FICHADA)).min(1),
    solicitud_id: z.string().min(1).optional(),
    articulo_id: z.string().min(1).optional(),
  })
  .strict();

/** @typedef {z.infer<typeof capaTeoricaSegmentadaSchema>} CapaTeoricaSegmentada */
export const capaTeoricaSegmentadaSchema = z
  .object({
    fecha_base: z.string().regex(YMD),
    segmentos: z.array(segmentoTeoricoSchema),
    ingreso_teorico_final: z.string().regex(ISO_DT).nullable(),
    egreso_teorico_final: z.string().regex(ISO_DT).nullable(),
    horas_teoricas_totales: z.number().min(0).max(48),
    turno_compuesto_id: z.string().min(1).nullable().optional(),
    tiene_huecos: z.boolean(),
    clasificacion_dia_calendario_id: cfgCdcIdSchema,
    calendario_evento_ref: z.string().regex(YMD).nullable().optional(),
    multiplicador_institucional: z.number().nullable().optional(),
    tipo_dia: z.enum(TIPO_DIA_OPERATIVO),
    es_feriado: z.boolean().optional(),
    version_capa_teorica: z.number().int().positive().optional(),
    expectativas_fichada_extra: z.array(expectativaFichadaExtraSchema).optional(),
    fichadas_esperadas: z.number().int().min(0).optional(),
    turno_id: z.string().nullable().optional(),
    ingreso: z.string().nullable().optional(),
    egreso: z.string().nullable().optional(),
    horas_efectivas: z.number().min(0).optional(),
  })
  .strict();

export const coberturaParcialOverrideSchema = z
  .object({
    tipo_override_id: cfgTovIdSchema,
    tipo_compensacion_id: cfgTccIdSchema,
    persona_origen_id: z.string().regex(PER_ID),
    persona_cobertura_id: z.string().regex(PER_ID),
    segmentos_cubiertos: z.array(z.string().min(1)).min(1),
    motivo: z.string().min(3).max(500),
    es_override_manual: z.literal(true).default(true),
    tipo: z.literal("cobertura_parcial").optional(),
  })
  .strict();

/**
 * @param {unknown} data
 * @returns {import("zod").infer<typeof capaTeoricaSegmentadaSchema>}
 */
export function parseCapaTeoricaSegmentada(data) {
  return capaTeoricaSegmentadaSchema.parse(data);
}
