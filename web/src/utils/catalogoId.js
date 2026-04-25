/**
 * Normaliza texto legible a segmento de ID de catálogo (mayúsculas, sin acentos comunes en ES).
 * @param {string} text
 */
export function slugifyCatalogoIdSegment(text) {
  if (typeof text !== "string") return "";
  const pre = text
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U");
  const decomposed = pre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return decomposed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * ID determinístico sugerido a partir del nombre (ej. "Planta Permanente" + prefijo `CFG_VIN_` → `CFG_VIN_PLANTA_PERMANENTE`).
 * @param {string} idPrefix p. ej. `CFG_VIN_` o `EFE_`
 * @param {string} nombreLegible
 */
export function sugerirIdCatalogo(idPrefix, nombreLegible) {
  const slug = slugifyCatalogoIdSegment(nombreLegible);
  const base = (idPrefix || "").toUpperCase();
  if (!slug) {
    return base.replace(/_+$/, "") || "CFG";
  }
  const p = base.endsWith("_") ? base : base ? `${base}_` : "";
  return `${p}${slug}`;
}
