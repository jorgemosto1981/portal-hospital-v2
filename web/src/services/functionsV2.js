import { getFunctions } from "firebase/functions";

import { appV2 } from "./firebase.js";

const REGION = "southamerica-east1";

let instance;

/**
 * Instancia `getFunctions(appV2, region)` contra Cloud Functions en la nube.
 */
export function getFunctionsV2() {
  if (!instance) {
    instance = getFunctions(appV2, REGION);
  }
  return instance;
}
