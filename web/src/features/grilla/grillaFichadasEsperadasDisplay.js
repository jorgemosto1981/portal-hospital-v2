/**
 * Presentación de fichadas esperadas (F-UX.2) en celdas vis_*.
 */

/** @param {unknown} raw */
export function parseFichadasEsperadasCelda(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/** @param {Record<string, unknown>|null|undefined} cell */
export function fichadasEsperadasDesdeCeldaVis(cell) {
  if (!cell || typeof cell !== "object") return null;
  return parseFichadasEsperadasCelda(cell.fichadas_esperadas);
}

/** @param {number|null} n */
export function etiquetaFichadasEsperadas(n) {
  if (n == null || n < 1) return null;
  return `F:${n}`;
}

/** @param {number|null} n */
export function titleFichadasEsperadas(n) {
  if (n == null) return null;
  return `Fichadas esperadas: ${n}`;
}
