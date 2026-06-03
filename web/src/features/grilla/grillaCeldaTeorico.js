/**
 * Reglas de teórico por celda — F-UX.3 (handoff §3.2, A1, A-FER).
 */
import { parseFichadasEsperadasCelda } from "./grillaFichadasEsperadasDisplay.js";

/** @param {unknown} capa */
export function capaTeoricaTieneSegmentos(capa) {
  const seg = capa && typeof capa === "object" ? capa.segmentos : null;
  return Array.isArray(seg) && seg.length > 0;
}

/**
 * Materializado para operar en modal (B/C y base de A).
 * @param {unknown} capaResp — respuesta obtenerCapaTeoricaDia
 */
export function diaMaterializadoParaGestion(capaResp) {
  const capa = capaResp?.capa_teorica ?? capaResp?.capa_teorica_grupo ?? null;
  return capaTeoricaTieneSegmentos(capa);
}

/**
 * @param {{ rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> } | null | undefined} turnoVis
 */
export function celdaElegibleIntercambioDesdeVis(turnoVis) {
  if (!turnoVis || typeof turnoVis !== "object") return false;
  if (turnoVis.es_franco === true) return false;
  const tipo = String(turnoVis.capa_teorica?.tipo_dia || "").toLowerCase();
  if (tipo === "franco" || tipo === "no_laborable" || tipo === "no-laborable") return false;
  const fichadas = parseFichadasEsperadasCelda(turnoVis.capa_teorica?.fichadas_esperadas);
  if (fichadas != null && fichadas >= 1) return true;
  return Boolean(turnoVis.rda_turno_id && !turnoVis.es_franco);
}

/**
 * @param {unknown} err
 */
export function mensajeErrorCapaTeorico(err) {
  const raw = String(err?.message || err || "").trim();
  if (!raw || raw === "internal") {
    return "No se pudo cargar el turno del día. Revise plan habilitado, materialización y cargo del grupo.";
  }
  if (raw.includes("ASI-PER")) return "El período está cerrado o en solo lectura para este día.";
  if (raw.includes("CAPA-")) return raw.replace(/^\[[^\]]+\]\s*/, "");
  return raw;
}

/**
 * Resumen una línea para cabecera modal.
 * @param {unknown} capa
 */
export function resumenTeoricoCorta(capa) {
  const seg = capa && typeof capa === "object" && Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (!seg.length) return "Sin turno calculado";
  const ids = seg.map((s) => String(s.turno_id || s.id || "?").trim()).filter(Boolean);
  const horario = seg[0]?.ingreso && seg[0]?.egreso ? `${seg[0].ingreso}–${seg[0].egreso}` : "";
  const f = parseFichadasEsperadasCelda(capa.fichadas_esperadas);
  const fTxt = f != null ? ` · F:${f}` : "";
  return `${ids.join("+")}${horario ? ` ${horario}` : ""}${fTxt}`;
}
