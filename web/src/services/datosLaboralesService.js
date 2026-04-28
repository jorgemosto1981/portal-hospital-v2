import { collection, getDocs, limit, query } from "firebase/firestore";

import { dbV2 } from "./firebase.js";
import { callGuardarRegistroLaboralTemporal, callListarColeccionPublicaTemporal } from "./callables.js";

/**
 * Lee una colección laboral de Firestore V2 con límite para vista web.
 * @param {string} collectionName
 * @param {number} maxRows
 */
export async function listarColeccionLaboral(collectionName, maxRows = 20) {
  const isCfg = String(collectionName).startsWith("cfg_");
  const isLaboralCore = [
    "grupos_de_trabajo",
    "historial_laboral_cargos",
    "historial_laboral_datos",
    "historial_laboral_grupos",
    "personas",
  ].includes(String(collectionName));

  if (isCfg || isLaboralCore) {
    const r = await callListarColeccionPublicaTemporal({ collectionName });
    const data = r && r.data && typeof r.data === "object" ? r.data : {};
    const items = Array.isArray(data.items) ? data.items : [];
    return items.slice(0, maxRows).map((item) => ({ ...item }));
  }

  const safeLimit = Number.isFinite(maxRows) ? Math.max(1, Math.min(100, maxRows)) : 20;
  const ref = collection(dbV2, collectionName);
  const snap = await getDocs(query(ref, limit(safeLimit)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function guardarRegistroLaboral(collectionName, datos) {
  const r = await callGuardarRegistroLaboralTemporal({ collectionName, datos });
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  return data;
}
