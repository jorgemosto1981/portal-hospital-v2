/**
 * Validación de fila para feedback temprano en el ABM (alineado a refineOpcionesConsumoVersion).
 * @param {Record<string, unknown>} row
 * @param {number | null} topeDiasPorEvento
 */
export function getOpcionConsumoRowFieldIssues(row, topeDiasPorEvento) {
  const etiquetaVacia = !String(row?.etiqueta_ui ?? "").trim();
  const diasRaw = row?.dias_por_evento;
  const dias = diasRaw === "" || diasRaw == null ? NaN : Number(diasRaw);
  const diasInvalido = !Number.isFinite(dias) || dias < 1;
  const superaTope =
    topeDiasPorEvento != null &&
    Number.isFinite(dias) &&
    dias > topeDiasPorEvento;

  return {
    etiquetaVacia,
    diasInvalido,
    superaTope,
    hasAny: etiquetaVacia || diasInvalido || superaTope,
  };
}

/**
 * @param {unknown[]} rows
 * @param {number | null} topeDiasPorEvento
 */
export function opcionesConsumoTienenErroresUi(rows, topeDiasPorEvento) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((row) => getOpcionConsumoRowFieldIssues(row, topeDiasPorEvento).hasAny);
}
