/**
 * Schema Zod — Capa teorica segmentada V2
 * Contrato: docs/v2/CAPA_TEORICA_SEGMENTOS_V2.md
 */
import { z } from "zod";
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
export const ORIGEN_SEGMENTO = ["plan_base", "override_cobertura", "licencia_ajuste"];
export const TIPO_DIA_OPERATIVO = ["laborable", "franco", "guardia", "no_laborable"];
export const segmentoTeoricoSchema = z.object({
  segmento_id: z.string().min(1),
  ingreso_iso: z.string().regex(ISO_DT),
  egreso_iso: z.string().regex(ISO_DT),
  fecha_base: z.string().regex(YMD),
  fecha_fin_real: z.string().regex(YMD).optional(),
  cruza_medianoche: z.boolean().default(false),
  persona_titular_id: z.string().min(1),
  persona_ejecutante_id: z.string().min(1),
  origen_segmento: z.enum(ORIGEN_SEGMENTO),
  tipo_compensacion_id: z.string().min(1).nullable().optional(),
}).strict();
export const capaTeoricaSegmentadaSchema = z.object({
  fecha_base: z.string().regex(YMD),
  segmentos: z.array(segmentoTeoricoSchema),
  clasificacion_dia_calendario_id: z.string().min(1),
  tipo_dia: z.enum(TIPO_DIA_OPERATIVO),
  tiene_huecos: z.boolean().default(false),
}).strict();
export const coberturaParcialOverrideSchema = z.object({
  tipo_override_id: z.string().min(1),
  tipo_compensacion_id: z.string().min(1),
  persona_origen_id: z.string().min(1),
  persona_cobertura_id: z.string().min(1),
  segmentos_cubiertos: z.array(z.string().min(1)).min(1),
  motivo: z.string().min(3).max(500),
  es_override_manual: z.literal(true).default(true),
}).strict();