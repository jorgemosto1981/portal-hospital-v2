/**
 * Schemas Zod — Catálogos cfg asistencia/turnos (Fase A0).
 * Contrato: docs/v2/DICCIONARIO_CFG_ASISTENCIA_TURNOS_V2.md
 */
import { z } from "zod";
import seedIds from "../../../scripts/seed-v2/seed-ids-asistencia-turnos.v2.json" with { type: "json" };

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

function idsFromManifest(section) {
  return Object.values(seedIds[section] || {});
}

const CFG_TCC_IDS = idsFromManifest("cfg_tipo_compensacion_cobertura");
const CFG_EPL_IDS = idsFromManifest("cfg_estado_periodo_liquidacion");
const CFG_CDC_IDS = idsFromManifest("cfg_clasificacion_dia_calendario");
const CFG_TOV_IDS = idsFromManifest("cfg_tipo_override_turno");

export const MANIFIESTO_A0 = {
  cfg_tipo_compensacion_cobertura: CFG_TCC_IDS,
  cfg_estado_periodo_liquidacion: CFG_EPL_IDS,
  cfg_clasificacion_dia_calendario: CFG_CDC_IDS,
  cfg_tipo_override_turno: CFG_TOV_IDS,
};

export const cfgTccIdSchema = z.enum(
  /** @type {[string, ...string[]]} */ (CFG_TCC_IDS),
);
export const cfgEplIdSchema = z.enum(
  /** @type {[string, ...string[]]} */ (CFG_EPL_IDS),
);
export const cfgCdcIdSchema = z.enum(
  /** @type {[string, ...string[]]} */ (CFG_CDC_IDS),
);
export const cfgTovIdSchema = z.enum(
  /** @type {[string, ...string[]]} */ (CFG_TOV_IDS),
);

export const cfgCatalogoItemSchema = z
  .object({
    id: z.string().min(1),
    codigo_interno: z.string().min(1).nullable(),
    titulo_ui: z.string().min(1),
    orden: z.number().int().nonnegative(),
  })
  .strict();

export const cfgTipoCompensacionCoberturaItemSchema = cfgCatalogoItemSchema.extend({
  id: cfgTccIdSchema,
});

export const cfgEstadoPeriodoLiquidacionItemSchema = cfgCatalogoItemSchema.extend({
  id: cfgEplIdSchema,
});

export const cfgClasificacionDiaCalendarioItemSchema = cfgCatalogoItemSchema.extend({
  id: cfgCdcIdSchema,
});

export const cfgTipoOverrideTurnoItemSchema = cfgCatalogoItemSchema.extend({
  id: cfgTovIdSchema,
});

export const catalogosAsistenciaTurnosPayloadSchema = z
  .object({
    cfg_tipo_compensacion_cobertura: z.array(cfgTipoCompensacionCoberturaItemSchema),
    cfg_estado_periodo_liquidacion: z.array(cfgEstadoPeriodoLiquidacionItemSchema),
    cfg_clasificacion_dia_calendario: z.array(cfgClasificacionDiaCalendarioItemSchema),
    cfg_tipo_override_turno: z.array(cfgTipoOverrideTurnoItemSchema),
  })
  .strict();

export const listarCatalogosAsistenciaTurnosResponseSchema = z
  .object({
    ok: z.literal(true),
    catalogos: catalogosAsistenciaTurnosPayloadSchema,
  })
  .strict();

/**
 * Valida respuesta del callable y que los ids activos coincidan con el manifiesto A0.
 * @param {unknown} data
 */
export function parseListarCatalogosAsistenciaTurnosResponse(data) {
  const parsed = listarCatalogosAsistenciaTurnosResponseSchema.parse(data);
  for (const [col, expectedIds] of Object.entries(MANIFIESTO_A0)) {
    const items = parsed.catalogos[col] || [];
    const got = new Set(items.map((i) => i.id));
    const missing = expectedIds.filter((id) => !got.has(id));
    if (missing.length) {
      throw new Error(`[A0] Faltan ids en ${col}: ${missing.join(", ")}`);
    }
  }
  return parsed;
}

/** @typedef {z.infer<typeof cfgCatalogoItemSchema>} CfgCatalogoItem */
/** @typedef {z.infer<typeof listarCatalogosAsistenciaTurnosResponseSchema>} ListarCatalogosAsistenciaTurnosResponse */
