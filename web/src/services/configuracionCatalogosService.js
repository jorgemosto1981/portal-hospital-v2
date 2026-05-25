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
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (!item || typeof item !== "object") return item;
    if (item.nombre) return item;
    // Compatibilidad de catálogos V2 que usan etiqueta/titulo_ui en lugar de nombre.
    const nombre = item.titulo_ui || item.etiqueta || item.codigo_interno || item.id || null;
    return { ...item, nombre };
  });
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
