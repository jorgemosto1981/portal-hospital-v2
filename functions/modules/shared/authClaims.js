"use strict";

const { auth, db } = require("./context");
const { COL_USUARIOS_CUENTA } = require("./constants");
const { computeLaborProfileForPersona } = require("./laborProfile");

/**
 * Unifica claims de sesión con perfil laboral (HLc→HLd→HLg) como `syncSessionClaims`.
 * Fuente canónica de rol: `roles_hlc_vigentes` (union de `rol_id` en cadenas HL vigentes).
 *
 * @param {string} uid - Firebase Auth uid
 * @param {string} personaId - `per_*`
 * @param {string} cuentaId - `usr_*`
 */
async function applyLaborAwareSessionClaims(uid, personaId, cuentaId) {
  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  const profile = await computeLaborProfileForPersona(personaId);
  const roles_hlc_vigentes = Array.isArray(profile.roles_hlc_vigentes) ? profile.roles_hlc_vigentes : [];

  await auth.setCustomUserClaims(uid, {
    ...prev,
    persona_id: personaId,
    cuenta_id: cuentaId,
    roles_hlc_vigentes,
    cargo_activo: profile.cargo_activo === true,
    labor_rol_conflicto: profile.rol_conflicto === true,
    portal_role: null,
    perfil_rol_id: null,
  });
  return { profile, roles_hlc_vigentes };
}

/**
 * Tras alta/actualización de HLc/HLd/HLg, refresca el token del agente si ya tiene Auth.
 * @param {string} personaId
 */
async function refreshSessionClaimsForPersona(personaId) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) return { refreshed: false };

  const snap = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", pid).limit(2).get();
  if (snap.empty || snap.size > 1) return { refreshed: false };

  const cuentaDoc = snap.docs[0];
  const cuentaId = cuentaDoc.id;
  const data = cuentaDoc.data() || {};
  const authUid = typeof data.auth_uid === "string" ? data.auth_uid.trim() : "";
  if (!authUid) return { refreshed: false };

  await applyLaborAwareSessionClaims(authUid, pid, cuentaId);
  return { refreshed: true, auth_uid: authUid };
}

module.exports = {
  applyLaborAwareSessionClaims,
  refreshSessionClaimsForPersona,
};
