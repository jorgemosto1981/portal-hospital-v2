/**
 * US-4 (escenario E) y US-5 (escenario F / Q3-2) — hints GSO en celda.
 * @see docs/v2/CRITERIOS_ACEPTACION_GSO_CONFLICTOS_CAPAS_V2.md §3 Escenarios E/F
 */
import {
  celdaTieneImputacionExterna,
  etiquetaGrupoAnclaEvento,
  eventoEsImputadoEnOtroGrupo,
} from "./grillaMesCellUtils.js";
import { celdaTieneJornadaVis } from "./grillaMesEquipoDisplay.js";

/** @param {string|null|undefined} ymd */
export function formatearFechaDdMmYyyy(ymd) {
  const y = String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return "";
  return `${y.slice(8, 10)}/${y.slice(5, 7)}/${y.slice(0, 4)}`;
}

/**
 * Q3-2 — copy oficial post-deshabilitar HLg.
 * @param {string|null|undefined} fechaCorte YYYY-MM-DD
 */
export function copyPostPurgeHlg(fechaCorte) {
  const f = formatearFechaDdMmYyyy(fechaCorte);
  if (f) {
    return `Sin dotación en este grupo desde el ${f}. Licencias del período anterior conservadas.`;
  }
  return "Sin dotación en este grupo. Licencias del período anterior conservadas.";
}

/**
 * Escenario E — fan-out / ancla en otro gdt.
 * @param {unknown} eventos
 * @param {string} [grupoVistaId]
 * @param {Record<string, string>} [etiquetasGrupo]
 */
export function evaluarImputacionExternaCelda(eventos, grupoVistaId, etiquetasGrupo = {}) {
  if (!celdaTieneImputacionExterna(eventos, grupoVistaId)) {
    return { activo: false };
  }
  const lista = Array.isArray(eventos) ? eventos : [];
  const ext = lista.find((ev) => eventoEsImputadoEnOtroGrupo(ev, grupoVistaId));
  const nombre = etiquetaGrupoAnclaEvento(ext, etiquetasGrupo);
  return {
    activo: true,
    tooltip: `Licencia gestionada en otro sector (${nombre})`,
    grupoAncla: nombre,
  };
}

/**
 * Escenario F — HLg inactiva / post-purge con licencia preservada.
 * @param {Record<string, unknown>|null|undefined} cell
 * @param {unknown} eventos
 * @param {{ fechaYmd?: string; vigenteHasta?: string|null }} [opts]
 */
export function evaluarPostPurgeHlgCelda(cell, eventos, opts = {}) {
  const evs = Array.isArray(eventos) ? eventos : [];
  if (evs.length === 0) return { activo: false };

  const fechaYmd = String(opts.fechaYmd || "").slice(0, 10);
  const vigenteHasta = String(opts.vigenteHasta || "").slice(0, 10);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(fechaYmd) &&
    /^\d{4}-\d{2}-\d{2}$/.test(vigenteHasta) &&
    fechaYmd > vigenteHasta
  ) {
    return {
      activo: true,
      tooltip: copyPostPurgeHlg(vigenteHasta),
      fechaCorte: vigenteHasta,
    };
  }

  const tipo = String(cell?.tipo_dia || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const esNoLaborable =
    tipo === "no_laborable" || tipo === "no-laborable" || tipo === "nolaborable";
  const sinJornada = !celdaTieneJornadaVis(cell);

  if (esNoLaborable && sinJornada) {
    const fechaCorte = vigenteHasta || null;
    return {
      activo: true,
      tooltip: copyPostPurgeHlg(fechaCorte),
      fechaCorte,
    };
  }

  return { activo: false };
}
