import { httpsCallable } from "firebase/functions";

import { getFunctionsV2 } from "./functionsV2.js";

/** Callable de comprobación (sin auth). */
export function callHealthV2() {
  return httpsCallable(getFunctionsV2(), "healthV2")();
}

/** Sincroniza `persona_id` / `cuenta_id` en custom claims (requiere usuario autenticado). */
export function callSyncSessionClaims() {
  return httpsCallable(getFunctionsV2(), "syncSessionClaims")();
}

/** RRHH: alta mínima persona + cuenta (requiere `portal_role: "rrhh"` en el token vía consola/Admin). */
export function callRrhhAltaAgente(data) {
  return httpsCallable(getFunctionsV2(), "rrhhAltaAgente")(data);
}

/** Primer acceso: DNI + email + PIN 6 (no requiere sesión previa del agente en Auth). */
export function callRegistroPrimerAcceso(data) {
  return httpsCallable(getFunctionsV2(), "registrarPrimerAcceso")(data);
}

/** Resuelve email (username) para DNI; luego el cliente hace signIn con email+PIN. Sin sesión. */
export function callResolverEmailLoginDni(data) {
  return httpsCallable(getFunctionsV2(), "resolverEmailLoginDni")(data);
}

/** RRHH: listar documentos de una colección de catálogo (incluye inactivos). */
export function callListarColeccion(data) {
  return httpsCallable(getFunctionsV2(), "listarColeccion")(data);
}

/** RRHH: guardar opción de catálogo (`set` + merge, id en mayúsculas). */
export function callGuardarOpcion(data) {
  return httpsCallable(getFunctionsV2(), "guardarOpcion")(data);
}

/** Catálogos de solo lectura para el wizard (provincia, localidad, parentesco, grupos). */
export function callListarCatalogoOnboarding(data) {
  return httpsCallable(getFunctionsV2(), "listarCatalogoOnboarding")(data);
}

/** Vincular sesión de Auth a legajo pre-alta por DNI. */
export function callVincularCuentaConDni(data) {
  return httpsCallable(getFunctionsV2(), "vincularCuentaConDni")(data);
}

export function callOnboardingMvpPasoA(data) {
  return httpsCallable(getFunctionsV2(), "onboardingMvpPasoA")(data);
}

export function callOnboardingMvpDdjjFamiliar(data) {
  return httpsCallable(getFunctionsV2(), "onboardingMvpDdjjFamiliar")(data);
}

export function callOnboardingMvpCompletar() {
  return httpsCallable(getFunctionsV2(), "onboardingMvpCompletar")();
}
