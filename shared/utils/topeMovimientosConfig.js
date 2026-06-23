/**
 * Tope movimientos gestión turno — configuración piloto (D1, D6).
 * Ratificado RRHH 2026-06-23 · vigencia 1 jul 2026 00:00 ART.
 */

/** @type {string | null} ISO-8601; movimientos con creado_en >= este instante cuentan. */
export const TOPE_MOVIMIENTOS_VIGENTE_DESDE = "2026-07-01T03:00:00.000Z";

export const TOPE_MOVIMIENTOS_MAX = 2;

export const MENSAJE_BATCH_LIM_001 =
  "Límite de movimientos excedido para este tramo (máx. 2 por día). Contacte a RRHH para solicitar una excepción.";
