"use strict";

const { logger } = require("firebase-functions/v2");
const {
  materializarTurnoTeoricoDia,
  recalcularAnaliticaValidacionFichadaTrasTeoria,
} = require("../asistencia/rdaTurnoTeoricoWorker");

const PER_ID = /^per_[A-Z0-9]+$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const GDT_ID = /^gdt_[A-Z0-9]+$/i;

/**
 * Ciclo micro post-mutación: materializar teoría + recalcular fichada por celda.
 * @param {Array<{ personaId: string, fechaYmd: string, grupoId: string }>} pares
 * @param {{ logTag?: string }} [opts]
 */
async function ejecutarCicloMicroEnPares(pares, opts = {}) {
  const logTag = opts.logTag || "post_mutacion";
  const visto = new Set();
  /** @type {Array<{ personaId: string, fechaYmd: string, grupoId: string }>} */
  const ok = [];

  for (const par of pares || []) {
    const personaId = String(par.personaId || "").trim();
    const fechaYmd = String(par.fechaYmd || "").trim();
    const grupoId = String(par.grupoId || "").trim();
    if (!PER_ID.test(personaId) || !YMD.test(fechaYmd) || !GDT_ID.test(grupoId)) continue;
    const k = `${personaId}|${fechaYmd}|${grupoId}`;
    if (visto.has(k)) continue;
    visto.add(k);

    try {
      const mat = await materializarTurnoTeoricoDia({ personaId, grupoId, fechaYmd });
      if (!mat?.ok) {
        logger.warn(`materializarTurnoTeoricoDia_${logTag} SKIP`, {
          personaId, fecha: fechaYmd, grupoId, error: mat?.error,
        });
      }
      const rec = await recalcularAnaliticaValidacionFichadaTrasTeoria({
        personaId,
        grupoId,
        fechaYmd,
      });
      if (!rec?.ok) {
        logger.warn(`recalcularAnaliticaValidacionFichadaTrasTeoria_${logTag}`, {
          personaId, fecha: fechaYmd, grupoId, motivo: rec?.motivo,
        });
      }
      ok.push({ personaId, fechaYmd, grupoId });
    } catch (e) {
      logger.error(`cicloMicroCelda_${logTag} ERROR`, {
        personaId, fecha: fechaYmd, grupoId, error: String(e),
      });
    }
  }
  return ok;
}

module.exports = { ejecutarCicloMicroEnPares };
