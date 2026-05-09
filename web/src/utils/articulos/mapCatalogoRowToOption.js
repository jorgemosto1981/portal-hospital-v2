/**
 * Mapea una fila de catálogo (callable / Firestore) a opción de select.
 * @param {Record<string, unknown>} row
 * @returns {({ value: string, label: string }) | null}
 */
export function mapCatalogoRowToOption(row) {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || "").trim();
  if (!id) return null;
  const label =
    String(row.nombre || "").trim() ||
    String(row.titulo_ui || "").trim() ||
    String(row.etiqueta || "").trim() ||
    String(row.codigo_interno || "").trim() ||
    id;
  return { value: id, label };
}
