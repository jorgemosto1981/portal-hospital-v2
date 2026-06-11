import { rolesHlcFromClaims } from "../../features/routing/portalRole.js";
import {
  puedeAccederShellGsoJefe,
  shellMenuPortalDesdePathname,
} from "../../features/routing/portalPerifericoCapabilities.js";

/**
 * @param {string} grupoId
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {(roles: readonly string[]) => boolean} hasPortalRoles
 * @param {{ pathname?: string }} [opts]
 */
export function grupoAccesiblePorClaims(grupoId, claims, hasPortalRoles, opts = {}) {
  const hlc = rolesHlcFromClaims(claims);
  const shellActiva = shellMenuPortalDesdePathname(opts.pathname);

  if (shellActiva === "jefe" && grupoId === "rrhh") return false;
  if (shellActiva === "rrhh" && grupoId === "jefe") return false;

  switch (grupoId) {
    case "usuario":
      return true;
    case "jefe":
      return puedeAccederShellGsoJefe(claims, hasPortalRoles) || hlc.includes("CFG_JEFE");
    case "rrhh":
      return hasPortalRoles(["rrhh", "admin"]) || hlc.includes("CFG_RRHH");
    case "medico":
      return hasPortalRoles(["medico"]) || hlc.includes("CFG_MEDICO");
    case "visualizador":
      return hasPortalRoles(["visualizador"]) || hlc.includes("CFG_VISUALIZADOR");
    default:
      return true;
  }
}
