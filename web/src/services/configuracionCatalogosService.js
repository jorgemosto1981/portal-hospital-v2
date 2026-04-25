import { callGuardarOpcion, callListarColeccion } from "./callables.js";

/**
 * Lista todos los documentos de una colección permitida (incluye inactivos).
 * @param {string} collectionName
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function listarColeccion(collectionName) {
  const res = await callListarColeccion({ collectionName });
  const data = res.data;
  if (!data || typeof data !== "object") return [];
  const items = data.items;
  return Array.isArray(items) ? items : [];
}

/**
 * Alta / edición de opción de catálogo (callable RRHH).
 * @param {string} collectionName
 * @param {{ id: string; nombre: string; activo?: boolean; vigente_desde?: string | null; vigente_hasta?: string | null }} datos
 */
export async function guardarOpcion(collectionName, datos) {
  const res = await callGuardarOpcion({ collectionName, datos });
  return res.data;
}
