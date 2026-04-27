import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

import { callVincularCuentaConDni } from "./callables.js";
import { authV2 } from "./firebase.js";

export function normalizeDni(s) {
  return String(s ?? "").replace(/\D/g, "");
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signUpEmailPassword(email, password) {
  const e = String(email).trim().toLowerCase();
  return createUserWithEmailAndPassword(authV2, e, password);
}

/**
 * Vinculación al legajo (Callable) + `getIdToken(true)` para leer `persona_id` en el token.
 * @param {string} dni
 */
export async function vincularCuentaPorDni(dni) {
  const d = normalizeDni(dni);
  if (!/^\d{6,12}$/.test(d)) {
    throw new Error("DNI inválido (6 a 12 dígitos).");
  }
  const { data } = await callVincularCuentaConDni({ dni: d });
  if (!data?.ok) {
    throw new Error("No se pudo vincular con RRHH.");
  }
  const u = authV2.currentUser;
  if (u) {
    await u.getIdToken(true);
  }
  return data;
}

export async function signOutV2() {
  await signOut(authV2);
}
