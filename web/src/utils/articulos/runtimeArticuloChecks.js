/**
 * Utilidades cliente alineadas al callable `validarReglasArticuloV2` (functions).
 * La validación completa vive en servidor; aquí solo helpers para UI / preview.
 */

/**
 * @param {Array<{ severidad?: string }>} issues
 * @returns {typeof issues}
 */
export function filtrarIssuesBloqueantes(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.filter((i) => i && i.severidad !== "informacion");
}
