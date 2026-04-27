import { doc, onSnapshot } from "firebase/firestore";

import { dbV2 } from "./firebase.js";

export const ESTADO_PEND_ONBOARDING = "PENDIENTE_ONBOARDING";
export const ESTADO_ACTIVO_MVP = "ACTIVO";

/**
 * @param {import("firebase/firestore").DocumentData | null} p
 * @param {unknown} user
 */
export function needsMvpOnboardingPath(p, user) {
  if (!user) return false;
  if (!p) return true;
  if (p.estado === ESTADO_PEND_ONBOARDING) {
    return Boolean(p.metadata && p.metadata.auth_vinculado);
  }
  return false;
}

/**
 * Suscripción a `personas/{personaId}` (requiere claim y reglas; escritura solo Callables).
 * @param {string | null} personaId
 * @param {(data: import("firebase/firestore").DocumentData | null) => void} onData
 * @returns {() => void}
 */
export function subscribePersonaById(personaId, onData) {
  if (!personaId || !personaId.startsWith("per_")) {
    onData(null);
    return () => {};
  }
  const ref = doc(dbV2, "personas", personaId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) onData(null);
      else onData(snap.data());
    },
    () => onData(null),
  );
}
