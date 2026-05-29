/**
 * Schema Zod — Plan de Turno de Servicio V2
 * Contrato: docs/v2/PLAN_REGIMEN_HORARIO_V2.md
 *
 * Máquina de estados: BORRADOR → ENVIADO → HABILITADO (aprobado por superior).
 * EN_REVISION (RRHH revierte). Rechazo en cualquier punto → BORRADOR.
 *
 * Dos tipos: "perpetuo" (fijo/rotativo, sin grilla) y "mensual" (planificado, grilla día×agente).
 */

import { z } from "zod";

const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";
export const planTurnoIdSchema = z.string().regex(new RegExp(`^plt_${ULID_RE}$`));

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PERIODO = /^\d{4}-\d{2}$/;

export const ESTADOS_PLAN = /** @type {const} */ ([
  "BORRADOR",
  "ENVIADO",
  "EN_REVISION",
  "HABILITADO",
  "CERRADO",
]);
const estadoPlanSchema = z.enum(ESTADOS_PLAN);

const aprobacionSchema = z
  .object({
    actor_uid: z.string().min(1),
    actor_persona_id: z.string().nullable().default(null),
    fecha: z.string().regex(YMD),
    rol: z.enum(["jefe", "superior", "rrhh"]),
    accion: z.enum(["enviar", "aprobar", "rechazar", "revertir", "cerrar"]),
    observaciones: z.string().max(500).nullable().default(null),
  })
  .strict();

const HHMM_AR = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Intención que envía el editor al guardar (enriquecimiento en backend). */
export const asignacionDiaIntencionSchema = z
  .object({
    tipo_dia: z.enum(["laborable", "guardia", "franco", "no_laborable"]),
    turno_id: z.string().max(32).nullable().default(null),
  })
  .strict();

/** Celda persistida en plt_* tras guardar borrador. */
export const asignacionDiaMensualSchema = z
  .object({
    tipo_dia: z.enum(["laborable", "guardia", "franco", "no_laborable"]),
    turno_id: z.string().max(32).nullable().default(null),
    ingreso: z.string().regex(HHMM_AR).nullable().default(null),
    egreso: z.string().regex(HHMM_AR).nullable().default(null),
    ingreso_iso: z.string().max(40).nullable().default(null),
    egreso_iso: z.string().max(40).nullable().default(null),
    es_feriado: z.boolean().default(false),
    tipo_evento_institucional: z.string().max(64).nullable().default(null),
  })
  .strict();

const agenteGrillaMensualSchema = z
  .object({
    persona_id: z.string().min(1),
    regimen_horario_id: z.string().min(1),
    hlg_id: z.string().min(1),
    dias: z.record(z.string().regex(YMD), asignacionDiaMensualSchema),
  })
  .strict();

const agentePerpetualSchema = z
  .object({
    persona_id: z.string().min(1),
    regimen_horario_id: z.string().min(1),
    hlg_id: z.string().min(1),
    regimen_fecha_ancla: z.string().regex(YMD).nullable().default(null),
  })
  .strict();

const camposComunesPlanSchema = z.object({
  grupo_id: z.string().min(1),
  estado: estadoPlanSchema,
  creado_por_uid: z.string().min(1),
  creado_por_persona_id: z.string().nullable().default(null),
  historial_aprobaciones: z.array(aprobacionSchema).default([]),
  observaciones_rechazo: z.string().max(500).nullable().default(null),
});

export const planPerpetualSchema = camposComunesPlanSchema
  .extend({
    tipo_plan: z.literal("perpetuo"),
    vigente_desde: z.string().regex(YMD),
    vigente_hasta: z.string().regex(YMD).nullable().default(null),
    agentes: z.array(agentePerpetualSchema).min(1),
  })
  .strict();

const celdaGrillaAprobadaSchema = z
  .object({
    tipo_dia: z.string(),
    turno_id: z.string().nullable().optional(),
    turno_compuesto_id: z.string().nullable().optional(),
    ingreso: z.string().nullable().optional(),
    egreso: z.string().nullable().optional(),
    ingreso_iso: z.string().nullable().optional(),
    egreso_iso: z.string().nullable().optional(),
    es_franco: z.boolean().optional(),
    es_feriado: z.boolean().optional(),
    clasificacion_dia_calendario_id: z.string().nullable().optional(),
    fichadas_esperadas: z.number().nullable().optional(),
    segmentos: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const grillaAprobadaSchema = z
  .object({
    version: z.literal(1),
    periodo: z.string().regex(PERIODO),
    grupo_id: z.string().nullable().optional(),
    materializado_en: z.string(),
    agentes: z.array(
      z.object({
        persona_id: z.string().min(1),
        regimen_horario_id: z.string().min(1),
        hlg_id: z.string().nullable().optional(),
        dias: z.record(z.string().regex(YMD), celdaGrillaAprobadaSchema),
      }),
    ),
  })
  .strict();

export const planMensualSchema = camposComunesPlanSchema
  .extend({
    tipo_plan: z.literal("mensual"),
    periodo: z.string().regex(PERIODO),
    comentarios_jefe: z.string().max(200).nullable().default(null),
    plan_version_token: z.string().min(1).optional(),
    agentes: z.array(agenteGrillaMensualSchema).min(1).max(50),
    grilla_aprobada: grillaAprobadaSchema.optional(),
    grilla_aprobada_en: z.unknown().optional(),
  })
  .strict();

/** Payload del callable guardarPlanTurnoServicio (plan mensual). */
export const guardarPlanMensualDatosSchema = z
  .object({
    grupo_id: z.string().min(1),
    tipo_plan: z.literal("mensual"),
    periodo: z.string().regex(PERIODO),
    comentarios_jefe: z.string().max(200).nullable().optional(),
    plan_version_token: z.string().min(1).optional(),
    agentes: z
      .array(
        z
          .object({
            persona_id: z.string().min(1),
            regimen_horario_id: z.string().min(1),
            hlg_id: z.string().min(1),
            dias: z.record(z.string().regex(YMD), asignacionDiaIntencionSchema),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export const planTurnoServicioSchema = z.discriminatedUnion("tipo_plan", [
  planPerpetualSchema,
  planMensualSchema,
]);

/** @typedef {z.infer<typeof planPerpetualSchema>} PlanPerpetuo */
/** @typedef {z.infer<typeof planMensualSchema>} PlanMensual */
/** @typedef {z.infer<typeof planTurnoServicioSchema>} PlanTurnoServicio */
