"use strict";

const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd } = require("../shared/fechaLaboralYmd");

/**
 * Día fuera de vigencia HLg para foto de plan (rango inclusivo en fechas YMD).
 * @param {string} fechaYmd
 * @param {Record<string, unknown> | null | undefined} hlg
 */
function diaFueraVigenciaHlgPlan(fechaYmd, hlg) {
  const ymd = String(fechaYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !hlg) return false;
  const fi = hldHlgFechaInicioYmd(hlg);
  const ff = hldHlgFechaFinYmd(hlg);
  if (fi && ymd < fi) return true;
  if (ff && ymd > ff) return true;
  return false;
}

/**
 * Quita intención laborable en días fuera de vigencia HLg (deja franco).
 * @param {Record<string, { tipo_dia?: string, turno_id?: string | null }>} dias
 * @param {Record<string, unknown> | null | undefined} hlg
 */
function sanitizarDiasPlanSegunVigenciaHlg(dias, hlg) {
  if (!dias || typeof dias !== "object") return {};
  const out = { ...dias };
  for (const [ymd, cel] of Object.entries(out)) {
    if (!cel || typeof cel !== "object") continue;
    const tipo = String(cel.tipo_dia || "")
      .trim()
      .toLowerCase();
    if (tipo === "franco" || tipo === "no_laborable") continue;
    if (!diaFueraVigenciaHlgPlan(ymd, hlg)) continue;
    out[ymd] = { ...cel, tipo_dia: "franco", turno_id: null };
  }
  return out;
}

const COL_HLG = "historial_laboral_grupos";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Array<{ persona_id?: string, hlg_id?: string, dias?: Record<string, unknown> }>} agentes
 */
async function sanitizarAgentesPlanVigenciaHlg(db, agentes) {
  const list = Array.isArray(agentes) ? agentes : [];
  const out = [];
  for (const ag of list) {
    let hlg = null;
    const hlgId = String(ag.hlg_id || "").trim();
    if (hlgId) {
      const snap = await db.collection(COL_HLG).doc(hlgId).get();
      if (snap.exists) hlg = { id: snap.id, ...(snap.data() || {}) };
    }
    out.push({
      ...ag,
      dias: sanitizarDiasPlanSegunVigenciaHlg(
        ag.dias && typeof ag.dias === "object" ? ag.dias : {},
        hlg,
      ),
    });
  }
  return out;
}

module.exports = {
  diaFueraVigenciaHlgPlan,
  sanitizarDiasPlanSegunVigenciaHlg,
  sanitizarAgentesPlanVigenciaHlg,
};
