/**
 * Fusiona snapshot del nodo (store) con fallback de filas del listado.
 * Tras batch/intercambio el store se actualiza antes que `filas[]`; el fallback no debe pisar al store.
 * @param {{
 *   fromStore?: Record<string, unknown>|null;
 *   fallback?: Record<string, unknown>|null;
 *   pending?: boolean;
 *   mostrarResultadoFinal?: boolean;
 * }} params
 */
export function mergeCeldaNodoConFallback({
  fromStore,
  fallback,
  pending = false,
  mostrarResultadoFinal = false,
}) {
  const fb = fallback && typeof fallback === "object" ? fallback : {};
  const st = fromStore && typeof fromStore === "object" ? fromStore : {};
  const tieneStore = Object.keys(st).length > 0;
  const tieneFallback = Object.keys(fb).length > 0;

  if (mostrarResultadoFinal) {
    return tieneStore ? st : fb;
  }
  if (pending) {
    return { ...fb, ...st };
  }
  if (tieneStore) {
    return { ...fb, ...st };
  }
  return tieneFallback ? fb : {};
}
