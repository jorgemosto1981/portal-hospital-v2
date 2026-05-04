import {
  callGuardarRegistroPersonalTemporal,
  callListarColeccionPublicaTemporal,
} from "./callables.js";

export async function listarColeccionPersonal(collectionName, maxRows = null, onProgress) {
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

export async function guardarRegistroPersonal(collectionName, datos) {
  const r = await callGuardarRegistroPersonalTemporal({ collectionName, datos });
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  return data;
}

