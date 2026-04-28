import { callGuardarRegistroPersonalTemporal, callListarColeccionPublicaTemporal } from "./callables.js";

export async function listarColeccionPersonal(collectionName, maxRows = 100) {
  const r = await callListarColeccionPublicaTemporal({ collectionName });
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  const items = Array.isArray(data.items) ? data.items : [];
  return items.slice(0, maxRows).map((item) => ({ ...item }));
}

export async function guardarRegistroPersonal(collectionName, datos) {
  const r = await callGuardarRegistroPersonalTemporal({ collectionName, datos });
  const data = r && r.data && typeof r.data === "object" ? r.data : {};
  return data;
}
