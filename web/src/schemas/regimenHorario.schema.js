/**
 * Schema Zod — Régimen Horario V2
 * Contrato: docs/v2/PLAN_REGIMEN_HORARIO_V2.md
 *
 * 3 tipos de patrón: fijo (semanal), rotativo (cíclico), planificado (jefe arma grilla).
 * Cada tipo comparte el bloque de turno pero difiere en la estructura de días/ciclo/paleta.
 */

import { z } from "zod";

const ULID_RE = "[0-9A-HJKMNP-TV-Z]{26}";
export const cfgRegHorIdSchema = z.string().regex(new RegExp(`^CFG_REG_HOR_${ULID_RE}$`));

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmmSchema = z.string().regex(HH_MM);
const hhmmNoMedianocheSchema = hhmmSchema.refine((v) => v !== "00:00", {
  message: "00:00 no está permitido en regímenes",
});

const bandaHorariaSchema = z
  .object({
    desde: hhmmSchema,
    hasta: hhmmSchema,
  })
  .strict();

const descansoSchema = z
  .object({
    duracion_min: z.number().int().min(0).max(120),
    es_pago: z.boolean(),
    despues_de_horas: z.number().min(0).max(24),
  })
  .strict();

export const turnoSchema = z
  .object({
    ingreso: hhmmNoMedianocheSchema,
    egreso: hhmmNoMedianocheSchema,
    horas_efectivas: z.number().min(0).max(24),
    es_nocturno: z.boolean().default(false),
    tolerancia_ingreso_min: z.number().int().min(0).max(60).default(0),
    tolerancia_egreso_min: z.number().int().min(0).max(60).default(0),
    banda_ingreso: bandaHorariaSchema.nullable().default(null),
    banda_egreso: bandaHorariaSchema.nullable().default(null),
    descanso: descansoSchema.nullable().default(null),
  })
  .strict();

export const TIPOS_DIA = /** @type {const} */ (["laborable", "guardia", "no_laborable", "franco"]);
const tipoDiaSchema = z.enum(TIPOS_DIA);

const diaFijoSchema = z
  .object({
    dia_semana: z.number().int().min(1).max(7),
    tipo_dia: tipoDiaSchema,
    turno: turnoSchema.nullable(),
  })
  .strict()
  .refine(
    (d) => {
      if (d.tipo_dia === "laborable" || d.tipo_dia === "guardia") return d.turno !== null;
      return true;
    },
    { message: "Días laborables y guardias requieren turno" },
  );

const posicionCicloSchema = z
  .object({
    posicion: z.number().int().min(1),
    tipo_dia: tipoDiaSchema,
    turno: turnoSchema.nullable(),
  })
  .strict()
  .refine(
    (d) => {
      if (d.tipo_dia === "laborable" || d.tipo_dia === "guardia") return d.turno !== null;
      return true;
    },
    { message: "Posiciones laborables y guardias requieren turno" },
  );

const turnoDisponibleSchema = z
  .object({
    turno_id: z.string().min(1).max(10),
    etiqueta: z.string().min(1).max(50),
    ingreso: hhmmNoMedianocheSchema,
    egreso: hhmmNoMedianocheSchema,
    horas_efectivas: z.number().min(0).max(24),
    es_nocturno: z.boolean().default(false),
    tolerancia_ingreso_min: z.number().int().min(0).max(60).default(0),
    tolerancia_egreso_min: z.number().int().min(0).max(60).default(0),
    banda_ingreso: bandaHorariaSchema.nullable().default(null),
    banda_egreso: bandaHorariaSchema.nullable().default(null),
    descanso: descansoSchema.nullable().default(null),
  })
  .strict();

const reglasPlanificacionSchema = z
  .object({
    dias_trabajo_max_mes: z.number().int().min(1).max(31).nullable().default(null),
    dias_franco_min_mes: z.number().int().min(0).max(31).nullable().default(null),
    max_consecutivos_trabajo: z.number().int().min(1).max(31).nullable().default(null),
    min_consecutivos_franco: z.number().int().min(1).max(31).nullable().default(null),
  })
  .strict();

const camposComunesSchema = z.object({
  nombre: z.string().min(1).max(120),
  codigo: z.string().min(1).max(30),
  activo: z.boolean().default(true),
  carga_horaria_semanal_teorica: z.number().min(0).max(168).nullable().default(null),
  impacta_calendario_institucional: z.boolean().default(true),
  tipo_contrato_ids: z.array(z.string()).nullable().default(null),
  notas_rrhh: z.string().max(500).nullable().default(null),
  horas_extra_max_semanal: z.number().min(0).nullable().default(null),
  horas_extra_max_mensual: z.number().min(0).nullable().default(null),
  /**
   * Dimensión B — compara minutos teóricos de la jornada vs suma de fichadas (RFC análisis carga horaria total).
   * Independiente de tolerancia_ingreso/egreso por turno (dimensión A).
   */
  analisis_carga_horaria_total_habilitado: z.boolean().default(true),
  /** Tolerancia máxima de déficit diario (min) cuando el análisis B está habilitado. */
  tolerancia_debitohorario_minutos: z.number().int().min(0).max(180).default(30),
});

export const regimenFijoSchema = camposComunesSchema
  .extend({
    tipo_patron: z.literal("fijo"),
    dias: z
      .array(diaFijoSchema)
      .length(7)
      .refine(
        (dias) => {
          const semanas = dias.map((d) => d.dia_semana).sort();
          return JSON.stringify(semanas) === "[1,2,3,4,5,6,7]";
        },
        { message: "Debe incluir los 7 días de la semana (1=lunes a 7=domingo)" },
      ),
  })
  .strict();

export const regimenRotativoSchema = camposComunesSchema
  .extend({
    tipo_patron: z.literal("rotativo"),
    ciclo: z
      .array(posicionCicloSchema)
      .min(2)
      .max(60)
      .refine(
        (ciclo) => {
          for (let i = 0; i < ciclo.length; i++) {
            if (ciclo[i].posicion !== i + 1) return false;
          }
          return true;
        },
        { message: "Las posiciones del ciclo deben ser consecutivas comenzando en 1" },
      ),
    ciclo_total: z.number().int().min(2).max(60),
  })
  .strict();

export const regimenPlanificadoSchema = camposComunesSchema
  .extend({
    tipo_patron: z.literal("planificado"),
    turnos_disponibles: z
      .array(turnoDisponibleSchema)
      .min(1)
      .max(20)
      .refine(
        (turnos) => {
          const ids = turnos.map((t) => t.turno_id);
          return new Set(ids).size === ids.length;
        },
        { message: "Los turno_id deben ser únicos" },
      ),
    reglas_planificacion: reglasPlanificacionSchema.nullable().default(null),
  })
  .strict();

export const regimenHorarioSchema = z
  .discriminatedUnion("tipo_patron", [
    regimenFijoSchema,
    regimenRotativoSchema,
    regimenPlanificadoSchema,
  ])
  .superRefine((val, ctx) => {
    if (val.tipo_patron === "rotativo" && val.ciclo.length !== val.ciclo_total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ciclo_total debe coincidir con la cantidad de posiciones en el ciclo",
        path: ["ciclo_total"],
      });
    }
  });

/** @typedef {z.infer<typeof regimenFijoSchema>} RegimenFijo */
/** @typedef {z.infer<typeof regimenRotativoSchema>} RegimenRotativo */
/** @typedef {z.infer<typeof regimenPlanificadoSchema>} RegimenPlanificado */
/** @typedef {z.infer<typeof regimenHorarioSchema>} RegimenHorario */
