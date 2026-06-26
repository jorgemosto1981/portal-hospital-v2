"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { civilDateInZonaToUtcAnchorMs } = require("./fechaInstitucionalBa");

/**
 * Lógica pura del calendario institucional (SSoT de reglas de día).
 * Firestore y cache viven en calendarService (Functions) y calendarioInstitucionalService (web).
 */


const TIPOS_EVENTO_CALENDARIO = ["feriado", "asueto", "institucional"];

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizarYmdCalendario(raw) {
  const s = String(raw || "").trim().slice(0, 10);
  return RX_YMD.test(s) ? s : "";
}

/**
 * @param {string} ymd
 * @returns {boolean}
 */
function esFinDeSemanaYmd(ymd) {
  const n = normalizarYmdCalendario(ymd);
  if (!n) return false;
  const [y, m, d] = n.split("-").map(Number);
  const anchor = civilDateInZonaToUtcAnchorMs(y, m, d);
  const dow = new Date(anchor + 12 * 60 * 60 * 1000).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * @param {unknown} raw
 * @returns {{ tipo: string, descripcion: string, multiplicador: number, anual: boolean } | null}
 */
function normalizarEventoCalendario(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tipo = String(raw.tipo || "").trim().toLowerCase();
  if (!TIPOS_EVENTO_CALENDARIO.includes(tipo)) return null;
  const multiplicador = Number(raw.multiplicador);
  return {
    tipo,
    descripcion: String(raw.descripcion || "").trim(),
    multiplicador: Number.isFinite(multiplicador) && multiplicador > 0 ? multiplicador : 1,
    anual: raw.anual === true,
  };
}

/**
 * Índice en memoria: ymd exacto + clave MM-DD para eventos anuales.
 * @param {Array<{ id: string, data: Record<string, unknown> }>} docs
 */
function buildIndiceEventosCalendario(docs) {
  /** @type {Map<string, { tipo: string, descripcion: string, multiplicador: number, anual: boolean }>} */
  const porYmd = new Map();
  /** @type {Map<string, { tipo: string, descripcion: string, multiplicador: number, anual: boolean }>} */
  const porMesDia = new Map();

  for (const doc of docs || []) {
    const id = normalizarYmdCalendario(doc.id);
    const ev = normalizarEventoCalendario(doc.data);
    if (!id || !ev) continue;
    if (ev.anual) {
      const md = id.slice(5, 10);
      if (/^\d{2}-\d{2}$/.test(md)) porMesDia.set(md, ev);
    } else {
      porYmd.set(id, ev);
    }
  }

  return { porYmd, porMesDia };
}

/**
 * @param {string} ymd
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 */
function resolverEventoEnIndice(ymd, indice) {
  const n = normalizarYmdCalendario(ymd);
  if (!n || !indice) return null;
  if (indice.porYmd.has(n)) return indice.porYmd.get(n);
  const md = n.slice(5, 10);
  if (indice.porMesDia.has(md)) return indice.porMesDia.get(md);
  return null;
}

/**
 * @param {string} ymd
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 * @returns {{ esHabil: boolean, multiplicador: number, evento: object | null, esFinDeSemana: boolean }}
 */
function getInfoDiaDesdeIndice(ymd, indice) {
  const n = normalizarYmdCalendario(ymd);
  const finde = esFinDeSemanaYmd(n);
  const evento = resolverEventoEnIndice(n, indice);
  const tieneMarca = Boolean(evento);
  const esHabil = Boolean(n) && !finde && !tieneMarca;
  const multiplicador =
    evento && typeof evento === "object" && Number(evento.multiplicador) > 0
      ? Number(evento.multiplicador)
      : 1;
  return {
    esHabil,
    multiplicador,
    evento: evento || null,
    esFinDeSemana: finde,
  };
}

/**
 * @param {string} ymd
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 */
function esDiaHabilDesdeIndice(ymd, indice) {
  return getInfoDiaDesdeIndice(ymd, indice).esHabil;
}

/** Hábil simple: lun–vie; ignora feriados/asuetos del calendario institucional. */
function esDiaHabilSimpleYmd(ymd) {
  return !esFinDeSemanaYmd(ymd);
}

/**
 * @param {string} fechaInicio
 * @param {string} fechaFin
 */
function contarDiasHabilesSimpleInclusive(fechaInicio, fechaFin) {
  const dias = iterarYmdInclusive(fechaInicio, fechaFin);
  let n = 0;
  for (const ymd of dias) {
    if (esDiaHabilSimpleYmd(ymd)) n += 1;
  }
  return n;
}

/**
 * @param {string} desdeYmd
 * @param {string} hastaYmd
 * @returns {string[]}
 */
function iterarYmdInclusive(desdeYmd, hastaYmd) {
  const desde = normalizarYmdCalendario(desdeYmd);
  const hasta = normalizarYmdCalendario(hastaYmd);
  if (!desde || !hasta || desde > hasta) return [];
  const out = [];
  let [y, m, d] = desde.split("-").map(Number);
  const end = hasta;
  let cur = desde;
  let guard = 0;
  while (cur <= end && guard < 4000) {
    out.push(cur);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
    cur = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    guard += 1;
  }
  return out;
}

/**
 * @param {string} fechaInicio
 * @param {string} fechaFin
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 */
function contarDiasHabilesDesdeIndice(fechaInicio, fechaFin, indice) {
  const dias = iterarYmdInclusive(fechaInicio, fechaFin);
  let n = 0;
  for (const ymd of dias) {
    if (esDiaHabilDesdeIndice(ymd, indice)) n += 1;
  }
  return n;
}

/**
 * @param {string} fecha
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 * @param {number} [maxSaltos]
 */
function obtenerProximoDiaHabilDesdeIndice(fecha, indice, maxSaltos = 370) {
  const start = normalizarYmdCalendario(fecha);
  if (!start) return null;
  let cur = start;
  for (let i = 0; i < maxSaltos; i += 1) {
    if (esDiaHabilDesdeIndice(cur, indice)) return cur;
    const [y, m, d] = cur.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    cur = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Último YMD al completar `cantidadDiasHabiles` hábiles desde `fechaDesde` (inclusive).
 * @param {string} fechaDesde
 * @param {number} cantidadDiasHabiles
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 */
/**
 * @param {string} fechaDesde
 * @param {number} cantidadDiasHabiles
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 * @param {{ incluyeFeriadosInstitucionales?: boolean }} [opts]
 */
function fechaHastaPorDiasHabilesDesdeIndice(fechaDesde, cantidadDiasHabiles, indice, opts = {}) {
  const start = normalizarYmdCalendario(fechaDesde);
  const n = Number(cantidadDiasHabiles);
  const compuesto = opts.incluyeFeriadosInstitucionales !== false;
  if (!start || !Number.isFinite(n) || n < 1) return start || "";
  if (n === 1) return start;
  let count = 0;
  let cur = start;
  let last = start;
  for (let i = 0; i < 4000 && count < n; i += 1) {
    const habil = compuesto ? esDiaHabilDesdeIndice(cur, indice) : esDiaHabilSimpleYmd(cur);
    if (habil) {
      count += 1;
      last = cur;
    }
    const [y, m, d] = cur.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    cur = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  return last;
}

/**
 * Último día del evento en cómputo **corridos** (cantidad inclusive desde fechaDesde).
 * @param {string} fechaDesdeYmd
 * @param {number} cantidadDiasCorridos
 * @returns {string}
 */
function fechaHastaPorDiasCorridosInclusive(fechaDesdeYmd, cantidadDiasCorridos) {
  const desde = normalizarYmdCalendario(fechaDesdeYmd);
  if (!desde) return "";
  const dias =
    Number.isFinite(cantidadDiasCorridos) && cantidadDiasCorridos > 0
      ? Math.floor(cantidadDiasCorridos)
      : 1;
  if (dias <= 1) return desde;
  const [y, m, d] = desde.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** @param {string} desdeYmd @param {string} hastaYmd */
function contarDiasCorridosInclusive(desdeYmd, hastaYmd) {
  return iterarYmdInclusive(desdeYmd, hastaYmd).length;
}

/**
 * @param {string} ymd
 * @returns {string}
 */
function formatearYmdDdMmYyyy(ymd) {
  const n = normalizarYmdCalendario(ymd);
  if (!n) return "";
  const [y, m, d] = n.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Días del rango que no suman al cómputo de consumo (fines de semana y/o eventos institucionales).
 * Vacío en modo corridos (todos los días del rango consumen).
 * @param {string} desdeYmd
 * @param {string} hastaYmd
 * @param {{ porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> }} indice
 * @param {{ esModoCorridos?: boolean, incluyeFeriadosInstitucionales?: boolean }} [opts]
 * @returns {Array<{ fecha: string, fecha_formateada: string, motivo: string }>}
 */
function listarDiasDescontadosComputo(desdeYmd, hastaYmd, indice, opts = {}) {
  if (opts.esModoCorridos === true) return [];
  const dias = iterarYmdInclusive(desdeYmd, hastaYmd);
  const compuesto = opts.incluyeFeriadosInstitucionales !== false;
  /** @type {Array<{ fecha: string, fecha_formateada: string, motivo: string }>} */
  const out = [];
  for (const ymd of dias) {
    const finde = esFinDeSemanaYmd(ymd);
    const evento = compuesto ? resolverEventoEnIndice(ymd, indice) : null;
    const esHabil = compuesto ? !finde && !evento : !finde;
    if (esHabil) continue;
    let motivo = "No laborable";
    if (finde) motivo = "Fin de semana";
    else if (evento && typeof evento === "object") {
      const tipo = String(evento.tipo || "").trim();
      const desc = String(evento.descripcion || "").trim();
      if (desc) motivo = desc;
      else if (tipo === "feriado") motivo = "Feriado";
      else if (tipo === "asueto") motivo = "Asueto";
      else if (tipo === "institucional") motivo = "Día institucional";
      else motivo = "Evento de calendario";
    }
    out.push({
      fecha: ymd,
      fecha_formateada: formatearYmdDdMmYyyy(ymd),
      motivo,
    });
  }
  return out;
}

module.exports = { TIPOS_EVENTO_CALENDARIO, normalizarYmdCalendario, esFinDeSemanaYmd, normalizarEventoCalendario, buildIndiceEventosCalendario, resolverEventoEnIndice, getInfoDiaDesdeIndice, esDiaHabilDesdeIndice, esDiaHabilSimpleYmd, contarDiasHabilesSimpleInclusive, iterarYmdInclusive, contarDiasHabilesDesdeIndice, obtenerProximoDiaHabilDesdeIndice, fechaHastaPorDiasHabilesDesdeIndice, fechaHastaPorDiasCorridosInclusive, contarDiasCorridosInclusive, formatearYmdDdMmYyyy, listarDiasDescontadosComputo };
