import {
  cfgArticuloBorradorSchema,
  cfgArticuloPublicableSchema,
} from '../../schemas/articulo.schema.js';

/**
 * @param {unknown} data
 */
export function parseArticuloBorrador(data) {
  return cfgArticuloBorradorSchema.safeParse(data);
}

/**
 * @param {unknown} data
 */
export function parseArticuloPublicable(data) {
  return cfgArticuloPublicableSchema.safeParse(data);
}

/**
 * Doble puerta: publicación solo si borrador y publicable son válidos.
 * @param {unknown} data
 * @returns {boolean}
 */
export function canPublishArticulo(data) {
  return (
    parseArticuloBorrador(data).success &&
    parseArticuloPublicable(data).success
  );
}

/**
 * Readiness normativo (solo publicable): badge verde / panel de faltantes para publicar.
 * @param {unknown} data
 * @returns {boolean}
 */
export function isArticuloReadinessOk(data) {
  return parseArticuloPublicable(data).success;
}

/**
 * Errores de borrador para inputs (flatten Zod).
 * @param {unknown} data
 * @returns {import('zod').ZodFormattedError<unknown> | null}
 */
export function getArticuloBorradorFlattenErrors(data) {
  const r = parseArticuloBorrador(data);
  return r.success ? null : r.error.flatten();
}

/**
 * Lista legible de mensajes cuando falla el publicable (popover / panel).
 * @param {unknown} data
 * @returns {string[]}
 */
export function getArticuloPublicableIssueMessages(data) {
  const r = parseArticuloPublicable(data);
  if (r.success) return [];
  return r.error.issues.map((issue) => issue.message);
}
