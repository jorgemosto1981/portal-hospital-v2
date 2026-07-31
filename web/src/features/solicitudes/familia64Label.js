import {
  codigoFamilia64SinModalidad,
  nombreFamilia64SinModalidad,
} from "../../../../shared/utils/familia64Chip.js";

/**
 * Nombre neutro de la familia Art. 64 para la bandeja del jefe.
 *
 * Misma regla que el chip de alta del agente: el nombre de cfg incluye la
 * modalidad ("... CON GOCE DE HABERES"), que recién queda definida cuando el
 * jefe autoriza. Derivarlo de cfg en vez de fijar un texto conserva el
 * calificador del par (p. ej. "(Personal 1/2 carga)").
 */

/**
 * ¿Trámite de familia 64 con la modalidad todavía sin definir?
 * @param {Record<string, unknown> | null | undefined} s
 */
export function esFamilia64SinModalidad(s) {
  return s?.articulo_familia_64 === true && !s?.modalidad_goce_jefe;
}

/**
 * Nombre del artículo a mostrarle al jefe: sin modalidad mientras no esté
 * decidida, y el de cfg una vez resuelta.
 * @param {Record<string, unknown> | null | undefined} s
 * @param {string} nombreCfg
 */
export function nombreArticuloParaJefe(s, nombreCfg) {
  return esFamilia64SinModalidad(s) ? nombreFamilia64SinModalidad(nombreCfg) : nombreCfg;
}

/**
 * Código del artículo a mostrarle al jefe. La letra del par (`64-A`) también es
 * modalidad, así que se cae junto con el nombre hasta que haya decisión.
 * @param {Record<string, unknown> | null | undefined} s
 * @param {string} codigoCfg
 */
export function codigoArticuloParaJefe(s, codigoCfg) {
  return esFamilia64SinModalidad(s) ? codigoFamilia64SinModalidad(codigoCfg) : codigoCfg;
}
