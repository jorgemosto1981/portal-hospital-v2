/**
 * Reglas de teórico por celda — F-UX.3 (handoff §3.2, A1, A-FER).
 */
import { parseFichadasEsperadasCelda } from "./grillaFichadasEsperadasDisplay.js";
import {
  horaDesdeIso,
  horarioOperativoDesdeVis,
  horarioDisplayDesdeCapaTeorica,
} from "./grillaHorarioInstitucional.js";
import { textoHorarioTurno } from "./grillaMesEquipoDisplay.js";
import { labelTurnoToken } from "./enrichCapaTeoricaLabels.js";

export { horaDesdeIso, horarioOperativoDesdeVis } from "./grillaHorarioInstitucional.js";

/** @param {unknown} capa */
export function capaTeoricaTieneSegmentos(capa) {
  const seg = capa && typeof capa === "object" ? capa.segmentos : null;
  return Array.isArray(seg) && seg.length > 0;
}

/**
 * Capa mínima para Flujo C cuando no hay segmentos materializados (franco, NL, feriado, sin calcular).
 * @param {unknown} capaApi
 * @param {unknown} visDia
 * @param {{ es_franco?: boolean; capa_teorica?: Record<string, unknown> } | null | undefined} turnoVis
 */
export function capaContextoParaFlujoC(capaApi, visDia, turnoVis) {
  if (capaApi && typeof capaApi === "object" && capaTeoricaTieneSegmentos(capaApi)) {
    return capaApi;
  }

  const vis = visDia && typeof visDia === "object" ? visDia : {};
  const tv = turnoVis && typeof turnoVis === "object" ? turnoVis : {};
  const ct = tv.capa_teorica && typeof tv.capa_teorica === "object" ? tv.capa_teorica : {};

  const tipoRaw = String(capaApi?.tipo_dia || vis.tipo_dia || ct.tipo_dia || "")
    .trim()
    .toLowerCase();
  const es_franco = capaApi?.es_franco === true
    || vis.es_franco === true
    || tv.es_franco === true
    || tipoRaw === "franco";
  const es_feriado = capaApi?.es_feriado === true
    || vis.es_feriado === true
    || ct.es_feriado === true;

  let tipo_dia = tipoRaw || null;
  if (!tipo_dia) {
    if (es_franco) tipo_dia = "franco";
    else if (tipoRaw === "no_laborable" || tipoRaw === "no-laborable") tipo_dia = "no_laborable";
    else tipo_dia = "laborable";
  }

  if (capaApi && typeof capaApi === "object") {
    return {
      ...capaApi,
      tipo_dia: capaApi.tipo_dia || tipo_dia,
      es_franco: capaApi.es_franco ?? es_franco,
      es_feriado: capaApi.es_feriado ?? es_feriado,
      segmentos: Array.isArray(capaApi.segmentos) ? capaApi.segmentos : [],
    };
  }

  return {
    tipo_dia,
    es_franco,
    es_feriado,
    segmentos: [],
  };
}

/** Mensaje cuando A/B requieren materialización previa. */
export const MSG_CALCULAR_DIA_FLUJO_AB =
  "Calculá el turno del día antes de usar este flujo.";

/**
 * @param {unknown} capaResp
 */
export function diaMaterializadoParaGestion(capaResp) {
  const capa = capaResp?.capa_teorica ?? capaResp?.capa_teorica_grupo ?? null;
  return capaTeoricaTieneSegmentos(capa);
}

/** @param {unknown} turnoVis */
export function celdaElegibleIntercambioDesdeVis(turnoVis) {
  if (!turnoVis || typeof turnoVis !== "object") return false;
  if (turnoVis.es_franco === true) return false;
  const tipo = String(turnoVis.capa_teorica?.tipo_dia || "").toLowerCase();
  if (tipo === "franco" || tipo === "no_laborable" || tipo === "no-laborable") return false;
  const fichadas = parseFichadasEsperadasCelda(turnoVis.capa_teorica?.fichadas_esperadas);
  if (fichadas != null && fichadas >= 1) return true;
  return Boolean(turnoVis.rda_turno_id && !turnoVis.es_franco);
}

/** @param {unknown} err */
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
 * @param {unknown} capa
 * @param {Record<string, { etiqueta?: string; codigo_interno?: string; turno_id?: string }>} [turnosPorId]
 */
function labelsTurnoDesdeCapa(capa, turnosPorId = {}) {
  if (!capa || typeof capa !== "object") return "";

  const comp = capa.turno_compuesto_id;
  if (comp) {
    const parts = String(comp)
      .split("+")
      .map((id) => {
        const meta = turnosPorId[id] || {};
        return meta.codigo_interno || labelTurnoToken(id) || meta.etiqueta || "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("+");
  }

  const seg = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (seg.length) {
    const parts = seg
      .map((s) => {
        const id = s.segmento_id || "";
        const meta = turnosPorId[id] || {};
        return meta.codigo_interno || labelTurnoToken(id) || meta.etiqueta || "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("+");
  }

  const tid = capa.turno_id ? labelTurnoToken(capa.turno_id) || capa.turno_id : "";
  return tid ? String(tid) : "";
}

/** @param {unknown} capa */
function horarioDesdeCapa(capa) {
  if (!capa || typeof capa !== "object") return "";

  const ingEnv = horaDesdeIso(capa.ingreso_teorico_final) || horaDesdeIso(capa.ingreso);
  const egrEnv = horaDesdeIso(capa.egreso_teorico_final) || horaDesdeIso(capa.egreso);
  const porSegmentos = horarioDisplayDesdeCapaTeorica(capa, ingEnv, egrEnv, false);
  if (porSegmentos) return porSegmentos;

  if (ingEnv && egrEnv) return `${ingEnv}–${egrEnv}`;

  const seg = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (seg.length) {
    const i = horaDesdeIso(seg[0].ingreso_iso);
    const e = horaDesdeIso(seg[seg.length - 1].egreso_iso);
    if (i && e) return `${i}–${e}`;
  }
  return "";
}

/** @param {unknown} tipo */
function etiquetaTipoDia(tipo) {
  const t = String(tipo || "").toLowerCase().replace(/\s+/g, "_");
  if (t === "franco") return "Franco";
  if (t === "no_laborable" || t === "no-laborable") return "No laborable";
  if (t === "guardia") return "Guardia";
  return "";
}

/**
 * @param {unknown} visDia
 * @param {{ rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> } | null | undefined} turnoVis
 */
function resumenDesdeVisGrilla(visDia, turnoVis) {
  const cell =
    visDia && typeof visDia === "object"
      ? visDia
      : {
          rda_turno_id: turnoVis?.rda_turno_id,
          rda_ingreso: turnoVis?.capa_teorica?.ingreso,
          rda_egreso: turnoVis?.capa_teorica?.egreso,
          es_franco: turnoVis?.es_franco,
          tipo_dia: turnoVis?.capa_teorica?.tipo_dia,
          fichadas_esperadas: turnoVis?.capa_teorica?.fichadas_esperadas,
          es_feriado: turnoVis?.capa_teorica?.es_feriado,
          tipo_evento_institucional: turnoVis?.capa_teorica?.tipo_evento_institucional,
        };

  const horario = textoHorarioTurno(cell);
  const turno =
    horario && horario !== "NL" && horario !== "F" ? horario : "";
  const tipo = etiquetaTipoDia(cell.tipo_dia) || (cell.es_franco ? "Franco" : "");
  const f = parseFichadasEsperadasCelda(cell.fichadas_esperadas);
  return { turno, tipo, fichadas: f, esFeriado: cell.es_feriado === true };
}

/**
 * Resumen una línea para cabecera modal (capa materializada).
 * @param {unknown} capa
 * @param {Record<string, { etiqueta?: string; codigo_interno?: string }>} [turnosPorId]
 */
export function resumenTeoricoCorta(capa, turnosPorId) {
  const linea = armarLineaResumen({
    labels: labelsTurnoDesdeCapa(capa, turnosPorId),
    horario: horarioDesdeCapa(capa),
    tipo: etiquetaTipoDia(capa?.tipo_dia),
    fichadas: parseFichadasEsperadasCelda(capa?.fichadas_esperadas),
    esFeriado: capa?.es_feriado === true,
    horas: capa?.horas_teoricas_totales,
  });
  return linea || "Sin turno calculado";
}

/**
 * Prioridad: capa API → vis del día → datos de la celda al abrir modal.
 * @param {{
 *   capa?: unknown;
 *   visDia?: unknown;
 *   turnoVis?: { rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> } | null;
 *   turnosPorId?: Record<string, { etiqueta?: string; codigo_interno?: string }>;
 * }} opts
 */
export function resumenTeoricoParaModal(opts = {}) {
  const { capa, visDia, turnoVis, turnosPorId } = opts;

  const horarioVis = horarioOperativoDesdeVis(visDia, turnoVis);
  const fichadasVis = parseFichadasEsperadasCelda(
    (visDia && typeof visDia === "object" ? visDia.fichadas_esperadas : null)
    ?? turnoVis?.capa_teorica?.fichadas_esperadas,
  );

  if (capa && capaTeoricaTieneSegmentos(capa)) {
    const linea = armarLineaResumen({
      labels: labelsTurnoDesdeCapa(capa, turnosPorId),
      horario: horarioVis || horarioDesdeCapa(capa),
      tipo: etiquetaTipoDia(capa.tipo_dia),
      fichadas: fichadasVis ?? parseFichadasEsperadasCelda(capa.fichadas_esperadas),
      esFeriado: capa.es_feriado === true || visDia?.es_feriado === true,
      horas: capa.horas_teoricas_totales,
    });
    if (linea) return linea;
  }

  const vis = resumenDesdeVisGrilla(visDia, turnoVis);
  const lineaVis = armarLineaResumen({
    labels: vis.turno && !vis.turno.includes("–") ? vis.turno : "",
    horario: horarioVis || (vis.turno && vis.turno.includes("–") ? vis.turno : ""),
    tipo: vis.tipo,
    fichadas: fichadasVis ?? vis.fichadas,
    esFeriado: vis.esFeriado,
  });
  if (lineaVis) return lineaVis;

  return "Sin turno calculado";
}

/**
 * @param {{
 *   labels?: string;
 *   horario?: string;
 *   tipo?: string;
 *   fichadas?: number | null;
 *   esFeriado?: boolean;
 *   horas?: number;
 * }} p
 */
function armarLineaResumen(p) {
  const partes = [];

  if (p.labels) partes.push(p.labels);
  else if (p.horario && p.horario !== "NL" && p.horario !== "F") partes.push(p.horario);
  else if (p.tipo) partes.push(p.tipo);
  else if (p.horario) partes.push(p.horario);

  if (p.horario && p.labels && !partes.includes(p.horario)) {
    partes.push(p.horario);
  }

  if (p.esFeriado) partes.push("Feriado");
  if (p.tipo && p.labels && p.tipo !== p.labels) partes.push(p.tipo);

  const hs =
    typeof p.horas === "number" && p.horas > 0 && !Number.isNaN(p.horas)
      ? `${p.horas} h`
      : "";
  if (hs && !partes.some((x) => x.includes(" h"))) partes.push(hs);

  return partes.filter(Boolean).join(" · ");
}
