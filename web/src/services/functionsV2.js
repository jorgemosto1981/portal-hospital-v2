import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

import { appV2 } from "./firebase.js";

const REGION = "southamerica-east1";

let instance;
let emulatorConnected;

/**
 * Instancia `getFunctions(appV2, region)`; opcionalmente enlaza al emulador local.
 * @see .env.v2.example — `VITE_V2_USE_FUNCTIONS_EMULATOR`, host/puerto.
 */
export function getFunctionsV2() {
  if (!instance) {
    instance = getFunctions(appV2, REGION);
    if (import.meta.env.VITE_V2_USE_FUNCTIONS_EMULATOR === "true" && !emulatorConnected) {
      const host = import.meta.env.VITE_V2_FUNCTIONS_EMULATOR_HOST || "127.0.0.1";
      const port = Number(import.meta.env.VITE_V2_FUNCTIONS_EMULATOR_PORT || "5002", 10);
      connectFunctionsEmulator(instance, host, port);
      emulatorConnected = true;
    }
  }
  return instance;
}
