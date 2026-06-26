import oleada63Specs from "../../../../docs/v2/seeds/oleada_63_p2/OLEADA_63_P2_SPECS.json";

import { filaArticuloIngresoDesdeCallable } from "./ticketeraRouteUtils.js";

/** @type {Map<string, Array<Record<string, unknown>>>} */
const OPCIONES_FALLBACK_POR_CODIGO = new Map();

for (const art of oleada63Specs.articulos || []) {
  const raw = art.opciones_consumo_solicitud;
  if (!Array.isArray(raw) || raw.length === 0) continue;
  const cod = String(art.codigo_grilla || art.codigo || "")
    .trim()
    .toUpperCase();
  if (!cod) continue;
  OPCIONES_FALLBACK_POR_CODIGO.set(
    cod,
    raw
      .filter((row) => row && row.activo !== false)
      .map((row) => ({
        id: String(row.id || "").trim(),
        etiqueta_ui: String(row.etiqueta_ui || "").trim(),
        dias_por_evento: Number(row.dias_por_evento) > 0 ? Math.floor(Number(row.dias_por_evento)) : 1,
        regla_computo_dias_id:
          row.regla_computo_id != null && String(row.regla_computo_id).trim()
            ? String(row.regla_computo_id).trim()
            : null,
        codigo_sarh: row.codigo_sarh != null ? String(row.codigo_sarh) : null,
      }))
      .filter((row) => row.id),
  );
}

/**
 * Normaliza fila del callable y, si el backend desplegado aún no expone P5.0b,
 * completa opciones conocidas por código de grilla (p. ej. 63-J).
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function enriquecerArticuloIngresoListado(raw) {
  const norm = filaArticuloIngresoDesdeCallable(raw);
  if (!norm) return null;

  const tieneOpciones = norm.opciones_consumo_solicitud.length > 0;
  const requiere = norm.requiere_opcion_consumo || tieneOpciones;

  if (requiere) {
    return {
      ...raw,
      ...norm,
      requiere_opcion_consumo: true,
      opciones_consumo_solicitud: norm.opciones_consumo_solicitud,
      dias_solicitados: norm.dias_solicitados ?? null,
      fecha_hasta: norm.fecha_hasta ?? null,
    };
  }

  const cod = String(norm.codigo_grilla || "").trim().toUpperCase();
  const fallback = OPCIONES_FALLBACK_POR_CODIGO.get(cod);
  if (!fallback?.length) {
    return { ...raw, ...norm };
  }

  return {
    ...raw,
    ...norm,
    requiere_opcion_consumo: true,
    opciones_consumo_solicitud: fallback,
    dias_solicitados: null,
    fecha_hasta: null,
  };
}
