/**
 * Nombre neutro de la familia Art. 64 para la bandeja del jefe.
 *
 * El nombre que viene de cfg incluye la modalidad ("... CON GOCE DE HABERES"),
 * que recién queda definida cuando el jefe autoriza. Mostrarlo antes adelanta
 * una decisión que todavía no se tomó.
 */
const NOMBRE_FAMILIA_64 = "ASUNTOS PARTICULARES";

/**
 * ¿Trámite de familia 64 con la modalidad todavía sin definir?
 * @param {Record<string, unknown> | null | undefined} s
 */
export function esFamilia64SinModalidad(s) {
  return s?.articulo_familia_64 === true && !s?.modalidad_goce_jefe;
}

/**
 * Nombre del artículo a mostrarle al jefe: neutro mientras no haya modalidad,
 * y el de cfg una vez resuelta.
 * @param {Record<string, unknown> | null | undefined} s
 * @param {string} nombreCfg
 */
export function nombreArticuloParaJefe(s, nombreCfg) {
  return esFamilia64SinModalidad(s) ? NOMBRE_FAMILIA_64 : nombreCfg;
}
