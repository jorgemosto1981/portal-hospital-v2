/** @param {URLSearchParams | { get: (k: string) => string | null }} searchParams */
export function articuloIdDesdeSearchParams(searchParams) {
  const id = String(searchParams.get("articulo") || searchParams.get("articulo_id") || "").trim();
  return /^art_/i.test(id) ? id : "";
}

/** @param {string | null | undefined} patron */
export function normalizarPatronSaldo(patron) {
  const p = String(patron || "B").trim().toUpperCase();
  if (p === "C") return "C";
  if (p === "B") return "B";
  if (p === "A") return "A";
  return p;
}

/**
 * @param {Record<string, unknown>} art — fila del callable listarArticulosIngresoAgente
 */
export function filaArticuloIngresoDesdeCallable(art) {
  const articulo_id = String(art?.articulo_id || "").trim();
  if (!articulo_id) return null;
  return {
    articulo_id,
    version_id: String(art?.version_id || "").trim() || null,
    patron_saldo: normalizarPatronSaldo(art?.patron_saldo),
    nombre: String(art?.nombre || "").trim(),
    codigo_grilla: String(art?.codigo_grilla || "").trim(),
    dias_solicitados: art?.dias_solicitados ?? null,
    fecha_hasta: art?.fecha_hasta ?? null,
    regla_computo_dias_id: art?.regla_computo_dias_id ?? null,
  };
}

/** @param {string} articuloId @param {Map<string, unknown>} catalogo */
export function esArticuloElegibleEnCatalogo(articuloId, catalogo) {
  const id = String(articuloId || "").trim();
  return id.length > 0 && catalogo.has(id);
}
