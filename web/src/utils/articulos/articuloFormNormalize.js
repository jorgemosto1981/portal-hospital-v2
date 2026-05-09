/** Prefijo idempotente para títulos al duplicar un artículo. */
export const ARTICULO_TITULO_PREFIJO_COPIA = '[COPIA]';

/**
 * Normaliza el título al duplicar: añade `[COPIA] ` si aún no comienza así (tras trim).
 * @param {string | undefined | null} titulo
 * @returns {string}
 */
export function getNormalizedTitleForDuplicado(titulo) {
  const raw = titulo == null ? '' : String(titulo);
  const trimmed = raw.trim();
  if (trimmed.startsWith(ARTICULO_TITULO_PREFIJO_COPIA)) {
    return trimmed;
  }
  if (!trimmed) {
    return `${ARTICULO_TITULO_PREFIJO_COPIA} Nuevo Artículo`;
  }
  return `${ARTICULO_TITULO_PREFIJO_COPIA} ${trimmed}`;
}
