/**
 * Claims de Firebase Auth — roles desde HLC (`roles_hlc_vigentes`).
 * `portal_role` / `perfil_rol_id`: solo lectura legacy.
 */

/** @param {unknown} v */
function asLowerString(v) {
  if (typeof v !== "string") return "";
  const t = v.trim().toLowerCase();
  return t || "";
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {string[]}
 */
export function rolesHlcFromClaims(claims) {
  if (!claims || typeof claims !== "object") return [];
  const raw = claims.roles_hlc_vigentes;
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x || "").trim()).filter(Boolean))];
  }
  const legacy = typeof claims.perfil_rol_id === "string" ? claims.perfil_rol_id.trim() : "";
  return legacy ? [legacy] : [];
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {boolean}
 */
export function claimsIncludeRrhh(claims) {
  if (rolesHlcFromClaims(claims).includes("CFG_RRHH")) return true;
  return hasAnyPortalRoleLegacy(claims, ["rrhh", "admin"]);
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {string | null}
 */
export function normalizePortalRole(claims) {
  if (!claims || typeof claims !== "object") return null;
  if (claimsIncludeRrhh(claims)) return "rrhh";
  const hlc = rolesHlcFromClaims(claims);
  if (hlc.includes("CFG_MEDICO")) return "medico";
  if (hlc.includes("CFG_VISUALIZADOR")) return "visualizador";
  if (hlc.includes("CFG_USUARIO")) return "usuario";
  return hasAnyPortalRoleLegacy(claims, ["rrhh", "admin", "medico", "visualizador", "usuario", "jefe"]);
}

/** @param {Record<string, unknown> | null | undefined} claims */
function hasAnyPortalRoleLegacy(claims, allowed) {
  const direct =
    asLowerString(claims?.portal_role) ||
    asLowerString(claims?.portalRole) ||
    asLowerString(claims?.role);
  if (direct) {
    const set = new Set(allowed.map((a) => String(a).trim().toLowerCase()));
    return set.has(direct);
  }
  return false;
}

/**
 * Jefe = tiene subordinados por jerarquía real en grupo de trabajo,
 * o legacy CFG_JEFE / portal_role "jefe".
 * @param {Record<string, unknown> | null | undefined} claims
 */
export function claimsIncludeJefe(claims) {
  if (!claims || typeof claims !== "object") return false;
  if (claims.tiene_subordinados === true) return true;
  if (rolesHlcFromClaims(claims).includes("CFG_JEFE")) return true;
  return hasAnyPortalRoleLegacy(claims, ["jefe"]);
}

export function hasAnyPortalRole(claims, allowed) {
  const set = new Set(allowed.map((a) => String(a).trim().toLowerCase()).filter(Boolean));
  if (set.has("rrhh") || set.has("admin")) {
    if (claimsIncludeRrhh(claims)) return true;
  }
  if (set.has("jefe") && claimsIncludeJefe(claims)) return true;
  const n = normalizePortalRole(claims);
  if (!n) return false;
  return set.has(n);
}

/** Roles con acceso a pantallas y callables de gestión RRHH (además del agente estándar). */
export const MANAGEMENT_PORTAL_ROLES = ["rrhh", "admin"];
