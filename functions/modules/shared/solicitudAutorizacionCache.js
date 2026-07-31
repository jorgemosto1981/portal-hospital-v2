"use strict";

/**
 * Cachés por invocación para resolver muchas cadenas de autorización en un mismo
 * listado (N1 de RFC_BANDEJA_JEFE_ESCALABILIDAD_LECTURA_V2).
 *
 * Son de solo lectura y de vida corta: se crean por llamada al callable y se
 * descartan al terminar. No sustituyen al snapshot `autorizadores_elegibles_ids`.
 */

/**
 * @returns {{
 *   hlgPorPersona: Map<string, Promise<Array<Record<string, unknown>>>>,
 *   hlgPorGrupo: Map<string, Promise<Array<Record<string, unknown>>>>,
 *   grupoTrabajo: Map<string, Promise<Record<string, unknown> | null>>,
 *   cadena: Map<string, Promise<Record<string, unknown>>>,
 * }}
 */
function crearCacheAutorizacion() {
  return {
    hlgPorPersona: new Map(),
    hlgPorGrupo: new Map(),
    grupoTrabajo: new Map(),
    cadena: new Map(),
  };
}

/**
 * Memoiza guardando la **promesa**, no el valor resuelto: así dos llamadas
 * concurrentes sobre la misma clave comparten un único viaje a Firestore.
 * Si la promesa falla, la clave se libera para no cachear el error.
 *
 * @template R
 * @param {Map<string, Promise<R>> | null | undefined} cache
 * @param {string} key
 * @param {() => Promise<R>} fn
 * @returns {Promise<R>}
 */
function memoAsync(cache, key, fn) {
  if (!cache) return fn();
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const pending = fn().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, pending);
  return pending;
}

module.exports = { crearCacheAutorizacion, memoAsync };
