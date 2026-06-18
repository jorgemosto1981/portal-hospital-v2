import { filtrarSegmentosActivosTitular } from "./enrichCapaTeoricaLabels.js";

/** @param {unknown} raw */
export function parseFichadasEsperadasCelda(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/** @param {Record<string, unknown>|null|undefined} cell */
export function fichadasEsperadasDesdeCeldaVis(cell) {
  if (!cell || typeof cell !== "object") return null;
  return parseFichadasEsperadasCelda(cell.fichadas_esperadas);
}

/** @param {number|null} n */
export function etiquetaFichadasEsperadas(n) {
  if (n == null || n < 1) return null;
  return `F:${n}`;
}

/** @param {number|null} n */
export function titleFichadasEsperadas(n) {
  if (n == null) return null;
  return `Fichadas esperadas: ${n}`;
}

/**
 * Bloques continuos del titular (T-08 — alineado con `capaTeoricaSegmentosCore`).
 * @param {Array<Record<string, unknown>>} segmentos
 * @param {string} [personaId]
 */
export function contarBloquesContinuosSegmentos(segmentos, personaId = "") {
  const pid = String(personaId || "").trim();
  const propios = (Array.isArray(segmentos) ? segmentos : [])
    .filter((s) => {
      const ej = String(s?.persona_ejecutante_id || "").trim();
      if (pid && ej && ej !== pid) return false;
      return true;
    })
    .sort((a, b) => String(a?.ingreso_iso || a?.segmento_id || "").localeCompare(
      String(b?.ingreso_iso || b?.segmento_id || ""),
    ));

  if (!propios.length) return 0;

  const tieneIso = propios.some((s) => s?.ingreso_iso && s?.egreso_iso);
  if (!tieneIso) return propios.length;

  let bloques = 0;
  let ultimoEgreso = null;
  for (const seg of propios) {
    const ingreso = String(seg?.ingreso_iso || "");
    const egreso = String(seg?.egreso_iso || "");
    if (!ultimoEgreso || ultimoEgreso !== ingreso) {
      bloques += 1;
    }
    ultimoEgreso = egreso || ultimoEgreso;
  }
  return bloques;
}

/**
 * Fichadas esperadas desde capa teórica; infiere desde segmentos si el campo falta o es 0.
 * @param {Record<string, unknown>|null|undefined} capa
 * @param {{ preview?: { segmentoIds?: string[]; segmentosCapa?: Array<Record<string, unknown>> }|null; personaId?: string }} [opts]
 */
export function fichadasEsperadasDesdeCapaTeorica(capa, opts = {}) {
  const { preview = null, personaId = "" } = opts;
  const fromCapa = parseFichadasEsperadasCelda(capa?.fichadas_esperadas);
  if (fromCapa != null && fromCapa >= 1) return fromCapa;

  const allSegs = Array.isArray(preview?.segmentosCapa)
    ? preview.segmentosCapa
    : Array.isArray(capa?.segmentos)
      ? capa.segmentos
      : [];
  const idsPreview = preview?.segmentoIds;
  const ids = Array.isArray(idsPreview) && idsPreview.length
    ? idsPreview.map(String)
    : allSegs.map((s) => String(s?.segmento_id || "")).filter(Boolean);
  const activosRaw = ids.length
    ? allSegs.filter((s) => ids.includes(String(s?.segmento_id || "")))
    : allSegs;
  const activos = personaId
    ? filtrarSegmentosActivosTitular(activosRaw, personaId)
    : activosRaw;
  if (!activos.length) return fromCapa === 0 ? null : fromCapa;

  const bloques = contarBloquesContinuosSegmentos(activos, personaId);
  const extras = Array.isArray(capa?.expectativas_fichada_extra)
    ? capa.expectativas_fichada_extra
    : [];
  const fichadasExtra = extras.reduce((acc, ex) => {
    const n = Number(ex?.cantidad_fichadas_esperadas);
    return acc + (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0);
  }, 0);
  const inferred = bloques * 2 + fichadasExtra;
  return inferred >= 1 ? inferred : fromCapa;
}
