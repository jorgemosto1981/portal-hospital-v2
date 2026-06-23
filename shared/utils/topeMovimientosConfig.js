/**
 * Tope movimientos gestión turno — configuración piloto (D1, D6).
 * `null` en vigente_desde: validación desactivada hasta fijar fecha en deploy.
 */

/** @type {string | null} ISO-8601; movimientos con creado_en >= este instante cuentan. */
export const TOPE_MOVIMIENTOS_VIGENTE_DESDE = null;

export const TOPE_MOVIMIENTOS_MAX = 2;

export const MENSAJE_BATCH_LIM_001 =
  "Límite de movimientos excedido para este tramo (máx. 2 por día). Contacte a RRHH o Jefe de Sala para una excepción.";
