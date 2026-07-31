"use strict";

/**
 * `map` asíncrono con concurrencia acotada, preservando el orden de entrada.
 * Pensado para resolver en lote lecturas Firestore que hoy se hacen en serie.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limite — máximo de tareas en vuelo (>= 1)
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function asyncMapLimite(items, limite, fn) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return [];

  const enVuelo = Math.max(1, Math.min(Math.floor(Number(limite) || 1), list.length));
  const out = new Array(list.length);
  let siguiente = 0;

  async function worker() {
    for (;;) {
      const i = siguiente;
      siguiente += 1;
      if (i >= list.length) return;
      out[i] = await fn(list[i], i);
    }
  }

  await Promise.all(Array.from({ length: enVuelo }, () => worker()));
  return out;
}

module.exports = { asyncMapLimite };
