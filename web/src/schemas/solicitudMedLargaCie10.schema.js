/**
 * Campos licencia médica larga + CIE-10 en `solicitudes_articulo`.
 * @see docs/v2/RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md
 */

import { z } from "zod";

const cfgCldIdSchema = z.string().regex(/^cfg_cld_[0-9A-Za-z_]+$/i, "causal_larga_duracion_id inválida");

export const TOPE_DIAS_LICENCIA_MEDICA_LARGA = 730;

export const cie10SolicitudMapSchema = z
  .object({
    codigo: z.string().min(2).max(12),
    descripcion: z.string().min(3).max(500),
    fecha_imputacion: z.unknown(),
  })
  .strict();

/**
 * @param {unknown} raw
 */
export function parseCie10SolicitudMap(raw) {
  return cie10SolicitudMapSchema.parse(raw);
}

export { cfgCldIdSchema };
