import {
  actorPortalTeoriaDesdeShell,
  PORTAL_FEATURE_SHELL,
} from "../grilla/actorPortalTeoriaDesdeShell.js";

/** Shell de ruta para turnos mensuales (no claim JWT). */
export const PLANES_TURNO_SHELL = {
  RRHH: PORTAL_FEATURE_SHELL.RRHH,
  JEFE: PORTAL_FEATURE_SHELL.JEFE,
};

/**
 * @typedef {Object} PlanesTurnoCapabilities
 * @property {PortalFeatureShell} shell
 * @property {"catalogo"|"hlg_vigente"} origenGrupos
 * @property {boolean} consolaTripleHorizonteEnFrio
 * @property {boolean} syncFocoEnUrl
 * @property {boolean} actorEsAuditoriaCentralPlan — permisos teoria G3 en editor de plan
 * @property {boolean} puedeVerBandejaAprobacionMasiva — inbox institucional RRHH
 * @property {boolean} muestraBotonVolverConsola
 * @property {string} rutaFocoBase
 */

/** @type {PlanesTurnoCapabilities} */
const RRHH_CAPABILITIES = {
  shell: PLANES_TURNO_SHELL.RRHH,
  origenGrupos: "catalogo",
  consolaTripleHorizonteEnFrio: false,
  syncFocoEnUrl: true,
  actorEsAuditoriaCentralPlan: true,
  puedeVerBandejaAprobacionMasiva: true,
  muestraBotonVolverConsola: false,
  rutaFocoBase: "/portal/rrhh/planes-turno",
};

/** @type {PlanesTurnoCapabilities} */
const JEFE_CAPABILITIES = {
  shell: PLANES_TURNO_SHELL.JEFE,
  origenGrupos: "hlg_vigente",
  consolaTripleHorizonteEnFrio: true,
  syncFocoEnUrl: true,
  actorEsAuditoriaCentralPlan: false,
  puedeVerBandejaAprobacionMasiva: false,
  muestraBotonVolverConsola: true,
  rutaFocoBase: "/portal/jefe/planes-turno",
};

/**
 * @param {string} shell
 * @returns {PlanesTurnoCapabilities}
 */
export function resolvePlanesTurnoCapabilities(shell) {
  if (shell === PLANES_TURNO_SHELL.RRHH) {
    return { ...RRHH_CAPABILITIES };
  }
  if (shell === PLANES_TURNO_SHELL.JEFE) {
    return { ...JEFE_CAPABILITIES };
  }
  throw new Error(`Shell planes turno desconocido: ${shell}`);
}

/**
 * @param {PlanesTurnoCapabilities} cap
 * @returns {boolean}
 */
export function shellEsPlanesRrhh(cap) {
  return cap.shell === PLANES_TURNO_SHELL.RRHH;
}

/**
 * @param {PlanesTurnoCapabilities} cap
 * @returns {boolean}
 */
export function cargaCatalogoGruposPlanes(cap) {
  return cap.origenGrupos === "catalogo";
}

/**
 * @param {PlanesTurnoCapabilities} cap
 * @param {{ personaId?: string; esJefe?: boolean; nivelJerarquico?: number | null }} sesion
 */
export function actorPortalTeoriaDesdePlanes(cap, sesion = {}) {
  return actorPortalTeoriaDesdeShell({
    shell: cap.shell,
    personaId: sesion.personaId,
    esJefeClaim: sesion.esJefe,
    nivelJerarquico: sesion.nivelJerarquico,
  });
}
