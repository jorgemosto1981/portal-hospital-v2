/**
 * Schema Zod — Override de turno puntual (cambio operativo diario).
 * Se almacena dentro de asistencia_diaria.overrides_turno[].
 */

import { z } from "zod";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const TIPOS_OVERRIDE = /** @type {const} */ (["reemplazo", "adicional"]);

export const overrideTurnoSchema = z
  .object({
    tipo: z.enum(TIPOS_OVERRIDE),
    ingreso: z.string().regex(HH_MM).nullable().default(null),
    egreso: z.string().regex(HH_MM).nullable().default(null),
    horas_efectivas: z.number().min(0).max(24).nullable().default(null),
    turno_id: z.string().max(10).nullable().default(null),
    motivo: z.string().min(3).max(500),
    es_override_manual: z.literal(true).default(true),
  })
  .strict();

export const registrarCambioTurnoInputSchema = z
  .object({
    persona_id: z.string().min(1),
    fecha: z.string().regex(YMD),
    override: overrideTurnoSchema,
  })
  .strict();

export const eliminarCambioTurnoInputSchema = z
  .object({
    persona_id: z.string().min(1),
    fecha: z.string().regex(YMD),
    override_index: z.number().int().min(0),
    motivo_eliminacion: z.string().min(3).max(500),
  })
  .strict();

/** @typedef {z.infer<typeof overrideTurnoSchema>} OverrideTurno */
