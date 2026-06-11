/**
 * Caché RAM de listados estáticos laborales (p. ej. `grupos_de_trabajo`).
 * Módulo puro: sin React; compartido entre grilla, planes y pantallas RRHH.
 */

/**
 * @param {string} coleccion
 * @param {number | null} [limit]
 * @returns {string}
 */
export function buildCatalogoLaboralCacheKey(coleccion, limit = null) {
  const col = String(coleccion || "").trim() || "_sin_col";
  const lim =
    limit == null || !Number.isFinite(Number(limit)) ? "all" : `l${Number(limit)}`;
  return `laboral:${col}:${lim}`;
}

/**
 * @param {{ ttlMs?: number | null }} [options] — `ttlMs: null` desactiva TTL
 */
export function createCatalogoLaboralCacheMemoryStore(options = {}) {
  const ttlMs = options.ttlMs === undefined ? 30 * 60 * 1000 : options.ttlMs;
  /** @type {Map<string, { data: unknown; cachedAt: number }>} */
  const map = new Map();

  function isExpired(entry) {
    if (ttlMs == null || ttlMs <= 0) return false;
    return Date.now() - entry.cachedAt > ttlMs;
  }

  /**
   * @param {string} key
   * @returns {unknown | undefined}
   */
  function get(key) {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (isExpired(entry)) {
      map.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  function has(key) {
    return get(key) !== undefined;
  }

  /**
   * @param {string} key
   * @param {unknown} data
   */
  function set(key, data) {
    map.set(key, { data, cachedAt: Date.now() });
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  function deleteKey(key) {
    return map.delete(key);
  }

  function clear() {
    map.clear();
  }

  return {
    get,
    set,
    has,
    delete: deleteKey,
    clear,
    size: () => map.size,
  };
}

/** Store singleton (catálogos institucionales). */
export const catalogoLaboralCacheStore = createCatalogoLaboralCacheMemoryStore();
