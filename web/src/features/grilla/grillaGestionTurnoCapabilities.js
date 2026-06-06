/**
 * Capabilities F-UX.3 — gestión turno desde grilla (RRHH + jefe, etapa 1).
 * Etapa 2: restringir por acción sin cambiar flujos.
 */

export const GESTION_TURNO_ACCION = {
  INTERCAMBIO: "grilla.asistencia.intercambio",
  CAMBIO_PROPIO: "grilla.asistencia.cambio_propio",
  HORAS_ADICIONALES: "grilla.asistencia.horas_adicionales",
  APLICAR_BATCH: "grilla.asistencia.aplicar_batch",
};

/**
 * @param {{ esRrhh?: boolean; esJefe?: boolean; gsoPermiteEscritura?: boolean }} ctx
 */
export function puedeGestionarTurnoEnGrilla(ctx) {
  const rolOk = Boolean(ctx?.esRrhh || ctx?.esJefe);
  return rolOk && Boolean(ctx?.gsoPermiteEscritura);
}

/**
 * @param {typeof GESTION_TURNO_ACCION[keyof typeof GESTION_TURNO_ACCION]} _accion
 * @param {{ esRrhh?: boolean; esJefe?: boolean; gsoPermiteEscritura?: boolean }} ctx
 */
export function tieneCapabilityGestionTurno(_accion, ctx) {
  return puedeGestionarTurnoEnGrilla(ctx);
}
