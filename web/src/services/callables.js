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
