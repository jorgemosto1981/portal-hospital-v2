"use strict";

const {
  CFG_MLM_CORTA_ANUAL,
  ESTADO_SOLICITUD_APROBADA,
} = require("./licenciaMedicaTramosCore");

const COL_SOLICITUDES = "solicitudes_articulo";

/**
 * Suma días aprobados de corta duración (Art. 14) en el año civil del titular.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ titular_persona_id: string, anio_calendario: number }} params
 */
async function sumarConsumoCortaAnualAprobado(db, params) {
  const personaId = String(params.titular_persona_id || "").trim();
  const anio = Number(params.anio_calendario);
  if (!personaId || !Number.isFinite(anio)) return 0;

  const ymdDesde = `${anio}-01-01`;
  const ymdHasta = `${anio}-12-31`;

  // Índice compuesto recomendado: titular_persona_id + estado_solicitud_id + fecha_desde
  const snap = await db
    .collection(COL_SOLICITUDES)
    .where("titular_persona_id", "==", personaId)
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_APROBADA)
    .where("fecha_desde", ">=", ymdDesde)
    .where("fecha_desde", "<=", ymdHasta)
    .get();

  let total = 0;
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const lm = d.licencia_medica;
    if (!lm || typeof lm !== "object") continue;
    if (String(lm.modo_licencia_medica_id || "").trim() !== CFG_MLM_CORTA_ANUAL) continue;
    const diasLm = Number(lm.dias_solicitud_total);
    if (Number.isFinite(diasLm) && diasLm > 0) {
      total += Math.floor(diasLm);
      continue;
    }
    const dias = Number(d.dias_solicitados);
    if (Number.isFinite(dias) && dias > 0) total += Math.floor(dias);
  }
  return total;
}

module.exports = { sumarConsumoCortaAnualAprobado };
