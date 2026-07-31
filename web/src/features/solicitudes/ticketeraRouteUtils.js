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
    requiere_opcion_consumo: art?.requiere_opcion_consumo === true,
    opciones_consumo_solicitud: Array.isArray(art?.opciones_consumo_solicitud)
      ? art.opciones_consumo_solicitud
      : [],
    modo_licencia_medica_id: art?.modo_licencia_medica_id ?? null,
    requiere_causal_larga: art?.requiere_causal_larga === true,
    requiere_cie10: art?.requiere_cie10 === true,
    tope_dias_solicitud: art?.tope_dias_solicitud ?? null,
    es_cambio_dia: art?.es_cambio_dia === true,
    cambio_dia_solicitud:
      art?.cambio_dia_solicitud && typeof art.cambio_dia_solicitud === "object"
        ? art.cambio_dia_solicitud
        : null,
    permite_retroactividad: art?.permite_retroactividad === true,
    plazo_preaviso_interno_dias:
      art?.plazo_preaviso_interno_dias == null
        ? null
        : Number.isFinite(Number(art.plazo_preaviso_interno_dias))
          ? Math.max(0, Math.floor(Number(art.plazo_preaviso_interno_dias)))
          : null,
    modo_resolucion_jefe: (() => {
      const m = String(art?.modo_resolucion_jefe || "").trim();
      if (m === "toma_conocimiento" || m === "ninguno" || m === "autorizacion") return m;
      return "autorizacion";
    })(),
    articulo_familia_64: art?.articulo_familia_64 === true,
    articulo_id_con_goce: (() => {
      const id = String(art?.articulo_id_con_goce || "").trim();
      return /^art_/i.test(id) ? id : null;
    })(),
    articulo_id_sin_goce: (() => {
      const id = String(art?.articulo_id_sin_goce || "").trim();
      return /^art_/i.test(id) ? id : null;
    })(),
  };
}

/** @param {string} articuloId @param {Map<string, unknown>} catalogo */
export function esArticuloElegibleEnCatalogo(articuloId, catalogo) {
  const id = String(articuloId || "").trim();
  return id.length > 0 && catalogo.has(id);
}
