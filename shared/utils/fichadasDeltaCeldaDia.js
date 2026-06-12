/**
 * Dirty checking capa 4 por celda día (§15.2C) y utilidades batch Firestore (§15.2D).
 */

export const FIRESTORE_BATCH_SAFE_MAX = 400;

/**
 * @param {unknown} raw
 * @returns {Array<Record<string, unknown>>}
 */
function normalizarFichadasReales(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((item) => {
      const o = /** @type {Record<string, unknown>} */ (item);
      const ingreso = o.ingreso != null ? String(o.ingreso).trim() : "";
      const egreso = o.egreso != null ? String(o.egreso).trim() : "";
      const hora = o.hora != null ? String(o.hora).trim() : "";
      const hora_hm = o.hora_hm != null ? String(o.hora_hm).trim() : "";
      if (ingreso || egreso) {
        return { ingreso, egreso };
      }
      if (hora_hm) return { hora_hm };
      if (hora) return { hora_hm: hora };
      return {};
    })
    .filter((x) => Object.keys(x).length > 0)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizarAdvertenciasFichadaAbiertas(raw) {
  if (!Array.isArray(raw)) return [];
  const set = new Set(
    raw
      .map((c) => String(c || "").trim())
      .filter(Boolean),
  );
  return [...set].sort();
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function arraysIgualesJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * §15.2C — ¿Hay delta que justifique un write en Firestore?
 *
 * @param {object} params
 * @param {unknown} [params.fichadas_reales_antes]
 * @param {unknown} [params.fichadas_reales_despues]
 * @param {unknown} [params.advertencias_antes]
 * @param {unknown} [params.advertencias_despues]
 * @returns {{ tiene_delta: boolean, write_skipped: boolean }}
 */
export function evaluarDeltaCeldaDia({
  fichadas_reales_antes,
  fichadas_reales_despues,
  advertencias_antes,
  advertencias_despues,
}) {
  const antesMarcas = normalizarFichadasReales(fichadas_reales_antes);
  const despuesMarcas = normalizarFichadasReales(fichadas_reales_despues);
  const antesAdv = normalizarAdvertenciasFichadaAbiertas(advertencias_antes);
  const despuesAdv = normalizarAdvertenciasFichadaAbiertas(advertencias_despues);

  const marcasCambiaron = !arraysIgualesJson(antesMarcas, despuesMarcas);
  const advertenciasCambiaron = !arraysIgualesJson(antesAdv, despuesAdv);
  const tiene_delta = marcasCambiaron || advertenciasCambiaron;

  return {
    tiene_delta,
    write_skipped: !tiene_delta,
  };
}

/**
 * Particiona operaciones para batch writes (techo Firestore 500).
 *
 * @template T
 * @param {T[]} operaciones
 * @param {number} [maxPorBatch]
 * @returns {T[][]}
 */
export function segmentarOperacionesFirestore(operaciones, maxPorBatch = FIRESTORE_BATCH_SAFE_MAX) {
  const max = Math.max(1, Math.min(500, Number(maxPorBatch) || FIRESTORE_BATCH_SAFE_MAX));
  const out = [];
  for (let i = 0; i < operaciones.length; i += max) {
    out.push(operaciones.slice(i, i + max));
  }
  return out;
}
