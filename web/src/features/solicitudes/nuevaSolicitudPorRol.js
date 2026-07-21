/**
 * Contrato UI — Nueva solicitud por paquete de rol.
 * @see docs/v2/RFC_ACCESO_ROLES_HLC_MENUS_V2.md
 */

export const ROL_CFG_USUARIO = "CFG_USUARIO";
export const ROL_CFG_RRHH = "CFG_RRHH";
export const ROL_CFG_MEDICO = "CFG_MEDICO";
export const ROL_CFG_VISUALIZADOR = "CFG_VISUALIZADOR";

/** @type {Readonly<Record<string, string>>} */
export const ETIQUETA_ROL_NUEVA_SOLICITUD = Object.freeze({
  [ROL_CFG_RRHH]: "Recursos Humanos",
  [ROL_CFG_MEDICO]: "Médico",
  [ROL_CFG_VISUALIZADOR]: "Visualizador",
});

/**
 * @param {string} rolId
 * @returns {boolean}
 */
export function rolPermiteTitularAjeno(rolId) {
  const r = String(rolId || "").trim();
  return r === ROL_CFG_RRHH || r === ROL_CFG_MEDICO || r === ROL_CFG_VISUALIZADOR;
}

/**
 * @param {unknown} row
 * @returns {Record<string, unknown> | null}
 */
export function mapArticuloNuevaSolicitud(row) {
  if (!row || typeof row !== "object") return null;
  const articulo_id = String(row.articulo_id || "").trim();
  if (!/^art_/i.test(articulo_id)) return null;
  return {
    articulo_id,
    version_id: String(row.version_id || "").trim() || null,
    codigo_grilla: String(row.codigo_grilla || "").trim() || "ART",
    nombre: String(row.nombre || "").trim(),
    patron_saldo: row.patron_saldo == null ? null : String(row.patron_saldo),
    circuito_ingreso_ids: Array.isArray(row.circuito_ingreso_ids)
      ? row.circuito_ingreso_ids.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    elegible_titular: row.elegible_titular === true,
    elegibilidad_mensajes: Array.isArray(row.elegibilidad_mensajes)
      ? row.elegibilidad_mensajes.map((m) => String(m || "").trim()).filter(Boolean)
      : [],
    alta_disponible: row.alta_disponible === true,
  };
}
