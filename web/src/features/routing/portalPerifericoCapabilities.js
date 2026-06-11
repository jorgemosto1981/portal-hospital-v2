/**
 * Capabilities por shell de ruta en superficies periféricas (bandejas, export, redirect).
 * No usar `claimsIncludeRrhh` en UI cuando la shell ya fija el contexto (Camino B).
 */

import { PORTAL_FEATURE_SHELL } from "../grilla/actorPortalTeoriaDesdeShell.js";
import {
  GRILLA_OPERATIVA_SHELL,
  resolveGrillaOperativaCapabilities,
} from "../grilla/grillaOperativaCapabilities.js";
import { readLastVisitedGsoShell } from "./portalGsoShellStorage.js";
import { rolesHlcFromClaims } from "./portalRole.js";

/**
 * @typedef {"jefe"|"rrhh"} PortalBandejaShell
 */

/**
 * @param {PortalBandejaShell} shell
 */
export function resolveBandejaSolicitudesCapabilities(shell) {
  const esRrhh = shell === PORTAL_FEATURE_SHELL.RRHH;
  return {
    shell,
    /** Badge «Sesión RRHH» solo en ruta RRHH, no por claim JWT en bandeja jefe. */
    muestraBadgeSesionRrhh: esRrhh,
    /** En `/portal/jefe/solicitudes` el acceso es por claim jefe, no por claim RRHH. */
    requiereClaimJefeEnRuta: !esRrhh,
    vistaInstitucionalPlanes: esRrhh,
  };
}

/**
 * Export JSON/CSV del read model laboral (pantalla técnica / auditoría).
 * @param {import("../grilla/grillaOperativaCapabilities.js").GrillaOperativaCapabilities} capGrilla
 */
export function permiteExportarReadModelLaboral(capGrilla) {
  return capGrilla?.permiteExportarMatrizMacro === true;
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {(roles: readonly string[]) => boolean} hasPortalRoles
 */
export function puedeAccederShellGsoJefe(claims, hasPortalRoles) {
  if (claims?.tiene_subordinados === true) return true;
  return hasPortalRoles(["jefe"]) || rolesHlcFromClaims(claims).includes("CFG_JEFE");
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {(roles: readonly string[]) => boolean} hasPortalRoles
 */
export function puedeAccederShellGsoRrhh(claims, hasPortalRoles) {
  return hasPortalRoles(["rrhh", "admin"]) || rolesHlcFromClaims(claims).includes("CFG_RRHH");
}

/**
 * @param {"jefe"|"rrhh"} shell
 */
export function puedeAccederShellGso(shell, claims, hasPortalRoles) {
  if (shell === "jefe") return puedeAccederShellGsoJefe(claims, hasPortalRoles);
  if (shell === "rrhh") return puedeAccederShellGsoRrhh(claims, hasPortalRoles);
  return false;
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {(roles: readonly string[]) => boolean} hasPortalRoles
 * @param {import("./portalGsoShellStorage.js").GsoShellId | null} [lastVisited]
 */
export function resolveGrillaPortalRedirectPath(claims, hasPortalRoles, lastVisited = readLastVisitedGsoShell()) {
  if (lastVisited && puedeAccederShellGso(lastVisited, claims, hasPortalRoles)) {
    return lastVisited === "rrhh"
      ? "/portal/rrhh/grilla-operativa"
      : "/portal/jefe/grilla-operativa";
  }
  if (puedeAccederShellGsoJefe(claims, hasPortalRoles)) {
    return "/portal/jefe/grilla-operativa";
  }
  if (puedeAccederShellGsoRrhh(claims, hasPortalRoles)) {
    return "/portal/rrhh/grilla-operativa";
  }
  return "/portal/home";
}

/**
 * Shell de menú lateral según prefijo de ruta (no claims JWT).
 * @param {string} pathname
 * @returns {"jefe"|"rrhh"|null}
 */
export function shellMenuPortalDesdePathname(pathname) {
  const p = String(pathname || "");
  if (p.startsWith("/portal/jefe/") || p === "/portal/jefe") return "jefe";
  if (p.startsWith("/portal/rrhh/") || p === "/portal/rrhh") return "rrhh";
  return null;
}

/**
 * @param {string} pathname
 * @returns {typeof GRILLA_OPERATIVA_SHELL.RRHH | typeof GRILLA_OPERATIVA_SHELL.JEFE}
 */
export function shellGrillaDesdePathname(pathname) {
  const p = String(pathname || "");
  if (p.includes("/portal/rrhh/")) return GRILLA_OPERATIVA_SHELL.RRHH;
  return GRILLA_OPERATIVA_SHELL.JEFE;
}

/**
 * @param {string} pathname
 */
export function resolveGrillaOperativaCapabilitiesDesdeRuta(pathname) {
  return resolveGrillaOperativaCapabilities(shellGrillaDesdePathname(pathname));
}
