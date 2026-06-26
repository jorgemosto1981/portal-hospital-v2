import { doc, getDoc } from "firebase/firestore";

import {
  PARAM_LM_INCOMPLETA_PLAZO_HORAS,
  resolverHorasDesdeParametroSistema,
} from "../../../shared/utils/licenciaMedicaParametrosCore.js";
import { dbV2 } from "./firebase.js";

/**
 * @param {string} paramId — id documento en cfg_parametros_sistema
 * @param {{ fallbackDevOnly?: number }} [opts]
 */
export async function leerParametroSistemaHoras(paramId, opts = {}) {
  const id = String(paramId || "").trim();
  if (!id) {
    throw new Error("param_id inválido.");
  }
  const snap = await getDoc(doc(dbV2, "cfg_parametros_sistema", id));
  if (!snap.exists()) {
    return resolverHorasDesdeParametroSistema(null, opts);
  }
  return resolverHorasDesdeParametroSistema(snap.data(), opts);
}

/** Horas para vencimiento de licencia incompleta (G3). */
export async function leerPlazoHorasLicenciaIncompleta(opts = {}) {
  return leerParametroSistemaHoras(PARAM_LM_INCOMPLETA_PLAZO_HORAS, opts);
}
