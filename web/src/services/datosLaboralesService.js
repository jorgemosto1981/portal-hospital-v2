import { collection, getDocs, limit, query } from "firebase/firestore";

import { dbV2 } from "./firebase.js";
import {
  callGuardarRegistroLaboralTemporal,
  callListarColeccionPublicaTemporal,
  callRrhhDeshabilitarHlc,
  callRrhhDeshabilitarHlg,
} from "./callables.js";

/**
 * Lee una colección laboral de Firestore V2.
 * Para colecciones servidas por Callable se pagina automáticamente.
 * @param {string} collectionName
 * @param {number|null} maxRows
 */
export async function listarColeccionLaboral(collectionName, maxRows = null, onProgress) {
  const isCfg = String(collectionName).startsWith("cfg_");
  const isLaboralCore = [
    "grupos_de_trabajo",
    "historial_laboral_cargos",
    "historial_laboral_datos",
    "historial_laboral_grupos",
    "personas",
  ].includes(String(collectionName));

  if (isCfg || isLaboralCore) {
    const targetMax =
      Number.isFinite(maxRows) && maxRows > 0 ? Math.trunc(maxRows) : Number.POSITIVE_INFINITY;
    const pageSize = 200;
    let pageToken = null;
    let hasMore = true;
    const items = [];
    while (hasMore && items.length < targetMax) {
      const r = await callListarColeccionPublicaTemporal({
        collectionName,
        pageSize,
        pageToken,
      });
      const data = r && r.data && typeof r.data === "object" ? r.data : {};
      const chunk = Array.isArray(data.items) ? data.items : [];
      items.push(...chunk.map((item) => ({ ...item })));
      if (typeof onProgress === "function") {
        onProgress({
          collectionName,
          loaded: items.length,
          pageSize,
          hasMore,
          pageToken,
        });
      }
      hasMore = data.hasMore === true;
      pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : null;
      if (!pageToken) hasMore = false;
      if (chunk.length === 0) hasMore = false;
    }
    return Number.isFinite(targetMax) ? items.slice(0, targetMax) : items;
  }

  const safeLimit = Number.isFinite(maxRows) ? Math.max(1, Math.min(1000, maxRows)) : 1000;
  const ref = collection(dbV2, collectionName);
  const snap = await getDocs(query(ref, limit(safeLimit)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function guardarRegistroLaboral(collectionName, datos) {
  const r = await callGuardarRegistroLaboralTemporal({ collectionName, datos });
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  return data;
}

export async function deshabilitarCicloHlc(data) {
  const r = await callRrhhDeshabilitarHlc(data);
  return r && r.data && typeof r.data === "object" ? r.data : {};
}

export async function deshabilitarAsignacionHlg(data) {
  const r = await callRrhhDeshabilitarHlg(data);
  return r && r.data && typeof r.data === "object" ? r.data : {};
}
