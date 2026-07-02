"use strict";

const {
  CFG_MLM_LARGA_EPISODIO,
  ESTADO_SOLICITUD_APROBADA,
} = require("./licenciaMedicaTramosCore");
const { calcularConsumoPrevioEpisodioContinuo } = require("./licenciaMedicaEpisodioCore");

const COL_SOLICITUDES = "solicitudes_articulo";

/**
 * Lista períodos aprobados de licencia larga (sin filtro anual).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ titular_persona_id: string }} params
 */
async function listarPeriodosLargaEpisodioAprobados(db, params) {
  const personaId = String(params.titular_persona_id || "").trim();
  if (!personaId) return [];

  const snap = await db
    .collection(COL_SOLICITUDES)
    .where("titular_persona_id", "==", personaId)
    .where("estado_solicitud_id", "==", ESTADO_SOLICITUD_APROBADA)
    .get();

  /** @type {Array<{ fecha_desde: string, fecha_hasta: string }>} */
  const periodos = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const lm = d.licencia_medica;
    if (!lm || typeof lm !== "object") continue;
    if (String(lm.modo_licencia_medica_id || "").trim() !== CFG_MLM_LARGA_EPISODIO) continue;
    const fecha_desde = String(d.fecha_desde || "").slice(0, 10);
    const fecha_hasta = String(d.fecha_hasta || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_desde) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_hasta)) {
      continue;
    }
    periodos.push({ fecha_desde, fecha_hasta });
  }
  return periodos;
}

/**
 * Consumo previo del episodio continuo (S_MED_LARGA) para la persona.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ titular_persona_id: string, fecha_desde: string }} params
 */
async function sumarConsumoEpisodioLargaAprobado(db, params) {
  const periodos = await listarPeriodosLargaEpisodioAprobados(db, {
    titular_persona_id: params.titular_persona_id,
  });
  return calcularConsumoPrevioEpisodioContinuo(periodos, params.fecha_desde);
}

module.exports = {
  listarPeriodosLargaEpisodioAprobados,
  sumarConsumoEpisodioLargaAprobado,
};
