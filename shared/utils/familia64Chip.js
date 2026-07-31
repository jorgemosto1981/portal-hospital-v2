/**
 * Etiquetas de la familia Art. 64 sin la modalidad.
 *
 * En cfg tanto el código como el nombre traen la modalidad (`64-A`,
 * "CON GOCE DE HABERES"), que recién queda definida cuando el jefe autoriza.
 * Mostrarla antes adelanta una decisión que todavía no se tomó, y aplica igual
 * al chip de alta del agente que a la bandeja del jefe.
 *
 * También se saca el calificador del par entre paréntesis (p. ej.
 * "(Personal 1/2 carga)"): el escalafón define qué par le toca a cada agente, así
 * que nunca ve dos, y el dato solo alarga la etiqueta.
 */

/** Sufijo de modalidad en el nombre. */
const RX_MODALIDAD_NOMBRE = /\s*\b(?:con|sin)\s+goce\s+de\s+haberes\b/gi;

/** Letra de modalidad pegada al número de artículo: `64-A`, `64 - B`. */
const RX_MODALIDAD_CODIGO = /^(\d+)\s*-\s*[A-Za-z](?![A-Za-z0-9])/;

/** Calificador del par, siempre al final: `... (Personal 1/2 carga)`. */
const RX_CALIFICADOR_PAR = /\s*\([^()]*\)\s*$/;

/** @param {unknown} s */
function limpiar(s) {
  return String(s || "")
    .replace(RX_CALIFICADOR_PAR, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * `"64-A (Personal 1/2 carga)"` → `"64"`
 * @param {unknown} codigo
 */
export function codigoFamilia64SinModalidad(codigo) {
  return limpiar(String(codigo || "").replace(RX_MODALIDAD_CODIGO, "$1"));
}

/**
 * `"ASUNTOS PARTICULARES CON GOCE DE HABERES (Personal 1/2 carga)"`
 * → `"ASUNTOS PARTICULARES"`
 * @param {unknown} nombre
 */
export function nombreFamilia64SinModalidad(nombre) {
  return limpiar(String(nombre || "").replace(RX_MODALIDAD_NOMBRE, ""));
}
