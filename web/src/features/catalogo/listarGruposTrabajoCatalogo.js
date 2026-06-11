import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import {
  buildCatalogoLaboralCacheKey,
  catalogoLaboralCacheStore,
} from "./catalogoLaboralCacheStore.js";

/** @type {Map<string, Promise<unknown[]>>} */
const inflightPorClave = new Map();

/**
 * Hit síncrono (sin red) para hidratar selectores al remontar.
 * @param {number} [limit]
 * @returns {unknown[] | undefined}
 */
export function peekGruposTrabajoCatalogo(limit = 400) {
  const key = buildCatalogoLaboralCacheKey("grupos_de_trabajo", limit);
  const cached = catalogoLaboralCacheStore.get(key);
  return Array.isArray(cached) ? cached : undefined;
}

/**
 * Listado de `grupos_de_trabajo` con caché RAM y coalescing de requests concurrentes.
 * @param {{ limit?: number; bypassCache?: boolean }} [options]
 * @returns {Promise<unknown[]>}
 */
export async function listarGruposTrabajoCatalogo(options = {}) {
  const limit = options.limit ?? 400;
  const bypassCache = Boolean(options.bypassCache);
  const key = buildCatalogoLaboralCacheKey("grupos_de_trabajo", limit);

  if (!bypassCache) {
    const cached = catalogoLaboralCacheStore.get(key);
    if (Array.isArray(cached)) return cached;

    const pending = inflightPorClave.get(key);
    if (pending) return pending;
  }

  const fetchPromise = listarColeccionLaboral("grupos_de_trabajo", limit)
    .then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!bypassCache) {
        catalogoLaboralCacheStore.set(key, list);
      }
      return list;
    })
    .finally(() => {
      inflightPorClave.delete(key);
    });

  if (!bypassCache) {
    inflightPorClave.set(key, fetchPromise);
  }

  return fetchPromise;
}
