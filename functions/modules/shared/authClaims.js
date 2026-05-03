"use strict";

const { auth } = require("./context");
const {
  computeLaborProfileForPersona,
  resolvePortalRoleForClaims,
} = require("./laborProfile");

/**
 * Unifica claims de sesión con perfil laboral (HLc→HLd→HLg) como `syncSessionClaims`.
 * Usar tras vínculo cuenta–persona u onboarding para no dejar `cargo_activo` / `perfil_rol_id` desactualizados.
 *
 * @param {string} uid - Firebase Auth uid
 * @param {string} personaId - `per_*`
 * @param {string} cuentaId - `usr_*`
 * @returns {Promise<{ profile: object, portal_role: string | null }>}
 */
async function applyLaborAwareSessionClaims(uid, personaId, cuentaId) {
  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  const profile = await computeLaborProfileForPersona(personaId);
  const portal_role = resolvePortalRoleForClaims({
    perfilRolId: profile.perfil_rol_id,
    cargoActivo: profile.cargo_activo,
    prevClaims: prev,
  });
  await auth.setCustomUserClaims(uid, {
    ...prev,
    persona_id: personaId,
    cuenta_id: cuentaId,
    perfil_rol_id: profile.perfil_rol_id || null,
    cargo_activo: profile.cargo_activo === true,
    labor_rol_conflicto: profile.rol_conflicto === true,
    portal_role: portal_role || null,
  });
  return { profile, portal_role };
}

module.exports = {
  applyLaborAwareSessionClaims,
};
