/**
 * Normaliza un documento Firestore `cfg_articulos` al shape del formulario (fechas civiles ISO).
 * Quita timestamps de servidor del objeto de edición.
 *
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {Record<string, unknown> | null}
 */
export function articuloCfgDocToFormState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const next = { ...raw };
  delete next.creado_en;
  delete next.actualizado_en;
  for (const k of ["vigente_desde", "vigente_hasta"]) {
    const v = next[k];
    if (v && typeof v.toDate === "function") {
      next[k] = v.toDate().toISOString().slice(0, 10);
    }
  }
  return next;
}
