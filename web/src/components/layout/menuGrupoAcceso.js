import { rolesHlcFromClaims, claimsIncludeRrhh } from "../../features/routing/portalRole.js";

/**
 * @param {string} grupoId
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {(roles: readonly string[]) => boolean} hasPortalRoles
 */
export function grupoAccesiblePorClaims(grupoId, claims, hasPortalRoles) {
  const hlc = rolesHlcFromClaims(claims);
  switch (grupoId) {
    case "usuario":
      return true;
    case "jefe":
      if (claimsIncludeRrhh(claims)) return true;
      if (claims && claims.tiene_subordinados === true) return true;
      return hasPortalRoles(["jefe"]) || hlc.includes("CFG_JEFE");
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
