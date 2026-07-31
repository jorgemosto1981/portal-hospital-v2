/**
 * Etiquetas de la familia Art. 64 sin la modalidad.
 *
 * En cfg tanto el código como el nombre traen la modalidad (`64-A`,
 * "CON GOCE DE HABERES"), que recién queda definida cuando el jefe autoriza.
 * Mostrarla antes adelanta una decisión que todavía no se tomó, y aplica igual
 * al chip de alta del agente que a la bandeja del jefe.
 *
 * Se conserva cualquier calificador del par (p. ej. "(Personal 1/2 carga)"),
 * que no habla de modalidad sino de a qué par pertenece el artículo.
 */

/** Sufijo de modalidad en el nombre. */
const RX_MODALIDAD_NOMBRE = /\s*\b(?:con|sin)\s+goce\s+de\s+haberes\b/gi;

/** Letra de modalidad pegada al número de artículo: `64-A`, `64 - B`. */
const RX_MODALIDAD_CODIGO = /^(\d+)\s*-\s*[A-Za-z](?![A-Za-z0-9])/;

/** @param {unknown} s */
function limpiarEspacios(s) {
  return String(s || "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * `"64-A (Personal 1/2 carga)"` → `"64 (Personal 1/2 carga)"`
 * @param {unknown} codigo
 */
export function codigoFamilia64SinModalidad(codigo) {
  return limpiarEspacios(String(codigo || "").replace(RX_MODALIDAD_CODIGO, "$1"));
}

/**
 * `"ASUNTOS PARTICULARES CON GOCE DE HABERES (Personal 1/2 carga)"`
 * → `"ASUNTOS PARTICULARES (Personal 1/2 carga)"`
 * @param {unknown} nombre
 */
export function nombreFamilia64SinModalidad(nombre) {
  return limpiarEspacios(String(nombre || "").replace(RX_MODALIDAD_NOMBRE, ""));
}
