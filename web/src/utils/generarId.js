import { ulid } from "ulid";

/** @returns {string} ID de documento en `personas` (prefijo `per_`). */
export function generarPersonaId() {
  return `per_${ulid()}`;
}

/** @returns {string} ID de documento en `historial_laboral_cargos` (prefijo `hlc_`). */
export function generarCargoId() {
  return `hlc_${ulid()}`;
}
