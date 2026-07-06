"use strict";

const { SCHEMA_MED_AVISO } = require("./avisoMedicoCajaNegraCore");
const { resolverRangoYmdEfectivoAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");

const COL_SOL = "solicitudes_articulo";

const LIMITE_VISIBLE_DEFAULT = 5;
const LIMITE_AMPLIADO_LEGACY = 25;
const PAGE_SIZE_MAX = 50;
const CURSOR_OFFSET_PREFIX = "off|";

/** Estados con trazabilidad útil para el auditor (post-ingreso o en junta). */
const ESTADOS_HISTORIAL_LM = new Set([
  "cfg_esa_aprobada",
  "cfg_esa_rechazada",
  "cfg_esa_esperando_dictamen_junta",
  "cfg_esa_en_revision_jefe",
  "cfg_esa_en_revision_rrhh",
]);

/**
 * @param {unknown} value
 */
function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

/**
 * @param {string} estadoId
 * @returns {"aprobada"|"rechazada"|"junta"|"otro"}
 */
function categoriaEstadoHistorialLm(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_rechazada") return "rechazada";
  if (e === "cfg_esa_esperando_dictamen_junta") return "junta";
  if (
    e === "cfg_esa_aprobada" ||
    e === "cfg_esa_en_revision_jefe" ||
    e === "cfg_esa_en_revision_rrhh"
  ) {
    return "aprobada";
  }
  return "otro";
}

/**
 * @param {string} estadoId
 */
function etiquetaEstadoHistorialLm(estadoId) {
  const e = String(estadoId || "").trim();
  if (e === "cfg_esa_aprobada") return "Aprobada";
  if (e === "cfg_esa_rechazada") return "Rechazada";
  if (e === "cfg_esa_esperando_dictamen_junta") return "En junta médica";
  if (e === "cfg_esa_en_revision_jefe") return "En revisión por jefe";
  if (e === "cfg_esa_en_revision_rrhh") return "En revisión RRHH";
  return e || "—";
}

/**
 * @param {Record<string, unknown>} sol
 */
function resolverMsOrdenHistorial(sol) {
  const clasif =
    sol.auditor_medico_clasificacion && typeof sol.auditor_medico_clasificacion === "object"
      ? sol.auditor_medico_clasificacion
      : null;
  const desdeClasif = timestampToMs(clasif?.clasificado_en);
  if (desdeClasif > 0) return desdeClasif;
  return timestampToMs(sol.creado_en);
}

/**
 * @param {Record<string, unknown>} sol
 */
function esSolicitudLmHistorial(sol) {
  if (String(sol.schema_version || "").trim() !== SCHEMA_MED_AVISO) return false;
  const estado = String(sol.estado_solicitud_id || "").trim();
  if (!ESTADOS_HISTORIAL_LM.has(estado)) return false;
  const rango = resolverRangoYmdEfectivoAvisoMedico(sol);
  return Boolean(rango);
}

/**
 * @param {string} cursor
 * @returns {number}
 */
function parseHistorialLmOffsetCursor(cursor) {
  const raw = String(cursor || "").trim();
  if (!raw.startsWith(CURSOR_OFFSET_PREFIX)) return 0;
  const n = Number.parseInt(raw.slice(CURSOR_OFFSET_PREFIX.length), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * @param {number} offset
 * @returns {string | null}
 */
function encodeHistorialLmOffsetCursor(offset) {
  const n = Math.max(0, Math.floor(Number(offset) || 0));
  return `${CURSOR_OFFSET_PREFIX}${n}`;
}

/**
 * @param {{ ampliado?: boolean, page_size?: unknown, cursor?: unknown }} params
 * @returns {{ pageSize: number, offset: number, legacyAmpliadoSinPaginar: boolean }}
 */
function parseHistorialLmPageOpts(params = {}) {
  const cursor = parseHistorialLmOffsetCursor(params.cursor);
  const legacyAmpliado =
    params.ampliado === true && params.page_size == null && !String(params.cursor || "").trim();

  if (legacyAmpliado) {
    return { pageSize: LIMITE_AMPLIADO_LEGACY, offset: 0, legacyAmpliadoSinPaginar: true };
  }

  const rawSize = Number(params.page_size);
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1
      ? Math.min(Math.floor(rawSize), PAGE_SIZE_MAX)
      : LIMITE_VISIBLE_DEFAULT;

  return { pageSize, offset: cursor, legacyAmpliadoSinPaginar: false };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   excluir_solicitud_id?: string,
 *   ampliado?: boolean,
 *   page_size?: number,
 *   cursor?: string,
 * }} params
 */
async function obtenerHistorialLmTitularBandejaAuditor(db, params) {
  const personaId = String(params.titular_persona_id || "").trim();
  const excluirSolId = String(params.excluir_solicitud_id || "").trim();
  const { pageSize, offset, legacyAmpliadoSinPaginar } = parseHistorialLmPageOpts(params);

  if (!/^per_/i.test(personaId)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "titular_persona_id inválido." };
  }

  const snap = await db.collection(COL_SOL).where("titular_persona_id", "==", personaId).get();

  const articuloCache = new Map();
  const candidatos = [];

  for (const doc of snap.docs) {
    if (excluirSolId && doc.id === excluirSolId) continue;
    const sol = { id: doc.id, ...(doc.data() || {}) };
    if (!esSolicitudLmHistorial(sol)) continue;

    const rango = resolverRangoYmdEfectivoAvisoMedico(sol);
    if (!rango) continue;

    const artId = String(sol.articulo_id || "").trim();
    const display = artId
      ? await loadArticuloDisplay(db, artId, articuloCache)
      : { codigo_grilla: "", articulo_label: "", nombre: "" };

    const estadoId = String(sol.estado_solicitud_id || "").trim();
    const clasif =
      sol.auditor_medico_clasificacion && typeof sol.auditor_medico_clasificacion === "object"
        ? sol.auditor_medico_clasificacion
        : null;

    candidatos.push({
      solicitud_id: doc.id,
      fecha_desde: rango.fecha_desde,
      fecha_hasta: rango.fecha_hasta,
      estado_solicitud_id: estadoId,
      estado_label: etiquetaEstadoHistorialLm(estadoId),
      estado_categoria: categoriaEstadoHistorialLm(estadoId),
      articulo_id: artId || null,
      codigo_grilla: String(display.codigo_grilla || "").trim(),
      articulo_label: String(display.articulo_label || display.nombre || "").trim(),
      creado_en: sol.creado_en ?? null,
      clasificado_en: clasif?.clasificado_en ?? null,
      _orden_ms: resolverMsOrdenHistorial(sol),
    });
  }

  candidatos.sort((a, b) => {
    if (b._orden_ms !== a._orden_ms) return b._orden_ms - a._orden_ms;
    return String(b.solicitud_id).localeCompare(String(a.solicitud_id));
  });

  const totalFiltrado = candidatos.length;

  if (legacyAmpliadoSinPaginar) {
    const probe = candidatos.slice(0, LIMITE_AMPLIADO_LEGACY);
    const items = probe.map(({ _orden_ms, ...row }) => row);
    return {
      ok: true,
      items,
      has_more: false,
      limite_visible: LIMITE_AMPLIADO_LEGACY,
      page_size: LIMITE_AMPLIADO_LEGACY,
      total_filtrado: totalFiltrado,
      next_cursor: null,
    };
  }

  const pageSlice = candidatos.slice(offset, offset + pageSize);
  const items = pageSlice.map(({ _orden_ms, ...row }) => row);
  const nextOffset = offset + pageSize;
  const hasMore = nextOffset < totalFiltrado;

  return {
    ok: true,
    items,
    has_more: hasMore,
    limite_visible: pageSize,
    page_size: pageSize,
    total_filtrado: totalFiltrado,
    next_cursor: hasMore ? encodeHistorialLmOffsetCursor(nextOffset) : null,
  };
}

module.exports = {
  obtenerHistorialLmTitularBandejaAuditor,
  categoriaEstadoHistorialLm,
  etiquetaEstadoHistorialLm,
  esSolicitudLmHistorial,
  parseHistorialLmPageOpts,
  parseHistorialLmOffsetCursor,
  encodeHistorialLmOffsetCursor,
  LIMITE_VISIBLE_DEFAULT,
  LIMITE_AMPLIADO_LEGACY,
  PAGE_SIZE_MAX,
};
