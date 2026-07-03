"use strict";

const {
  CFG_MLM_CORTA_ANUAL,
  ESTADO_SOLICITUD_APROBADA,
} = require("./licenciaMedicaTramosCore");
const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");

const COL_SOLICITUDES = "solicitudes_articulo";

/**
 * @param {Record<string, unknown>} d
 * @returns {{ fecha_desde: string, fecha_hasta: string, dias: number } | null}
 */
function extraerCortaAnualAprobadaDesdeSolicitud(d) {
  const lm = d.licencia_medica;
  if (!lm || typeof lm !== "object") return null;
  if (String(lm.modo_licencia_medica_id || "").trim() !== CFG_MLM_CORTA_ANUAL) return null;

  const fechaDesde = String(d.fecha_desde || d.fecha_inicio_reposo_estimada || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) return null;

  const diasLm = Number(lm.dias_solicitud_total);
  let dias = 0;
  if (Number.isFinite(diasLm) && diasLm > 0) {
    dias = Math.floor(diasLm);
  } else {
    const diasSol = Number(d.dias_solicitados);
    if (Number.isFinite(diasSol) && diasSol > 0) dias = Math.floor(diasSol);
  }
  if (dias < 1) return null;

  const fechaHasta = String(d.fecha_hasta || d.fecha_fin_reposo_estimada || fechaDesde).slice(0, 10);
  return { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, dias };
}

/**
 * @param {string} fechaDesde YYYY-MM-DD
 * @param {number} anio
 */
function fechaDesdeEnAnioCalendario(fechaDesde, anio) {
  const ymdDesde = `${anio}-01-01`;
  const ymdHasta = `${anio}-12-31`;
  return fechaDesde >= ymdDesde && fechaDesde <= ymdHasta;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ titular_persona_id: string, anio_calendario: number, excluir_solicitud_id?: string }} params
 * @returns {Promise<Array<{ sol_id: string, fecha_desde: string, fecha_hasta: string, dias: number, codigo_grilla: string, articulo_id: string | null }>>}
 */
async function listarHistorialConsumoCortaAnualAprobado(db, params) {
  const personaId = String(params.titular_persona_id || "").trim();
  const anio = Number(params.anio_calendario);
  const excluirSolId = String(params.excluir_solicitud_id || "").trim();
  if (!personaId || !Number.isFinite(anio)) return [];

  const snap = await db
    .collection(COL_SOLICITUDES)
    .where("titular_persona_id", "==", personaId)
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_APROBADA)
    .get();

  const artCache = new Map();
  const rows = [];

  for (const doc of snap.docs) {
    if (excluirSolId && doc.id === excluirSolId) continue;
    const d = doc.data() || {};
    const extraido = extraerCortaAnualAprobadaDesdeSolicitud(d);
    if (!extraido || !fechaDesdeEnAnioCalendario(extraido.fecha_desde, anio)) continue;

    const articuloId = String(d.articulo_id || "").trim() || null;
    const display = articuloId
      ? await loadArticuloDisplay(db, articuloId, artCache)
      : { codigo_grilla: "" };

    rows.push({
      sol_id: doc.id,
      fecha_desde: extraido.fecha_desde,
      fecha_hasta: extraido.fecha_hasta,
      dias: extraido.dias,
      codigo_grilla: String(display.codigo_grilla || "").trim(),
      articulo_id: articuloId,
    });
  }

  rows.sort((a, b) => {
    if (a.fecha_desde !== b.fecha_desde) return a.fecha_desde.localeCompare(b.fecha_desde);
    return a.sol_id.localeCompare(b.sol_id);
  });

  return rows;
}

/**
 * Suma días aprobados de corta duración (Art. 14) en el año civil del titular.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ titular_persona_id: string, anio_calendario: number }} params
 */
async function sumarConsumoCortaAnualAprobado(db, params) {
  const historial = await listarHistorialConsumoCortaAnualAprobado(db, params);
  return historial.reduce((acc, row) => acc + row.dias, 0);
}

module.exports = {
  sumarConsumoCortaAnualAprobado,
  listarHistorialConsumoCortaAnualAprobado,
  extraerCortaAnualAprobadaDesdeSolicitud,
};
