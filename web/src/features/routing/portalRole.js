/**
 * Claims de Firebase Auth: `portal_role` (y alias tolerados) para UI y guards.
 * Valores canónicos en minúsculas: `rrhh`, `admin`, etc.
 */

/** @param {unknown} v */
function asLowerString(v) {
  if (typeof v !== "string") return "";
  const t = v.trim().toLowerCase();
  return t || "";
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @returns {string | null}
 */
export function normalizePortalRole(claims) {
  if (!claims || typeof claims !== "object") return null;
  const direct =
    asLowerString(claims.portal_role) ||
    asLowerString(claims.portalRole) ||
    asLowerString(claims.role);
  if (direct) return direct;
  const roles = claims.roles;
  if (Array.isArray(roles)) {
    for (const x of roles) {
      const s = asLowerString(x);
      if (s) return s;
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} claims
 * @param {readonly string[]} allowed lowercase role ids
 */
export function hasAnyPortalRole(claims, allowed) {
  const n = normalizePortalRole(claims);
  if (!n) return false;
  const set = new Set(allowed.map((a) => String(a).trim().toLowerCase()).filter(Boolean));
  return set.has(n);
}

/** Roles con acceso a pantallas y callables de gestión RRHH (además del agente estándar). */
export const MANAGEMENT_PORTAL_ROLES = ["rrhh", "admin"];
