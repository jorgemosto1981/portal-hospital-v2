"use strict";

/**
 * Materialización acotada por rango YMD (F2 — plan §16.4).
 * No rematerializa el mes entero salvo que el rango lo cubra.
 */

const { iterarYmdInclusive } = require("../shared/mdcRdaDocumentIds");
const { assertNuevaSolicitudNoEnPeriodoCerrado } = require("./asistenciaPeriodoLiquidacion");
const { materializarTurnoMesBatch } = require("./rdaTurnoTeoricoWorker");

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string} ymd
 * @returns {{ anio: number, mes: number }}
 */
function anioMesDesdeYmd(ymd) {
  const y = Number(String(ymd).slice(0, 4));
  const m = Number(String(ymd).slice(5, 7));
  return { anio: y, mes: m };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   personaId: string,
 *   grupoId: string,
 *   fechaDesdeYmd: string,
 *   fechaHastaYmd?: string,
 *   motivo?: string,
 *   origenEventoId?: string | null,
 * }} params
 */
async function materializarRango(db, params) {
  const personaId = String(params.personaId || "").trim();
  const grupoId = String(params.grupoId || "").trim();
  const desde = String(params.fechaDesdeYmd || "").slice(0, 10);
  const hasta = String(params.fechaHastaYmd || desde).slice(0, 10);
  const motivo = String(params.motivo || "materializar_rango").trim() || "materializar_rango";

  if (!/^per_/i.test(personaId) || !/^gdt_/i.test(grupoId)) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "personaId y grupoId (gdt_*) requeridos." };
  }
  if (!RX_YMD.test(desde) || !RX_YMD.test(hasta) || desde > hasta) {
    return { ok: false, codigo: "RANGO_INVALIDO", mensaje: "fecha_desde / fecha_hasta YMD inválidos." };
  }

  await assertNuevaSolicitudNoEnPeriodoCerrado(db, personaId, desde, hasta, grupoId);

  const dias = iterarYmdInclusive(desde, hasta);
  if (dias.length === 0) {
    return { ok: true, diasProcesados: 0, motivo, meses: [] };
  }

  /** @type {Map<string, { anio: number, mes: number, desde: string, hasta: string }>} */
  const porMes = new Map();
  for (const ymd of dias) {
    const key = ymd.slice(0, 7);
    const { anio, mes } = anioMesDesdeYmd(ymd);
    const prev = porMes.get(key);
    if (!prev) {
      porMes.set(key, { anio, mes, desde: ymd, hasta: ymd });
    } else {
      if (ymd < prev.desde) prev.desde = ymd;
      if (ymd > prev.hasta) prev.hasta = ymd;
    }
  }

  let diasProcesados = 0;
  const meses = [];

  for (const entry of porMes.values()) {
    const batch = await materializarTurnoMesBatch({
      personaId,
      grupoId,
      anio: entry.anio,
      mes: entry.mes,
      fechaDesdeYmd: entry.desde,
      fechaHastaYmd: entry.hasta,
    });
    meses.push({
      periodo: `${entry.anio}-${String(entry.mes).padStart(2, "0")}`,
      fecha_desde: entry.desde,
      fecha_hasta: entry.hasta,
      ok: batch.ok,
      diasProcesados: batch.diasProcesados || 0,
      error: batch.error || null,
    });
    if (batch.ok) diasProcesados += batch.diasProcesados || 0;
  }

  return {
    ok: meses.every((m) => m.ok),
    diasProcesados,
    motivo,
    origen_evento_id: params.origenEventoId || null,
    meses,
  };
}

module.exports = { materializarRango };
