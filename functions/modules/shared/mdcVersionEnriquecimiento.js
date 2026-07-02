"use strict";

const {
  CFG_MLM_LARGA_EPISODIO,
  leerModoLicenciaMedicaDesdeVersion,
} = require("./licenciaMedicaTramosCore");
const { FASE_MOTOR_S_MED_LARGA } = require("./licenciaMedicaEpisodioCore");

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} p
 */
async function enriquecerPayloadMdcDesdeVersion(db, p) {
  const versionId = String(p.version_id_aplicada || "").trim();
  const articuloId = String(p.articulo_id || "").trim();
  if (!versionId || !articuloId) return p;

  const snap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  if (!snap.exists) return p;

  const topes = snap.data()?.bloque_topes_plazos_computo || {};
  const modo = leerModoLicenciaMedicaDesdeVersion(snap.data());
  const extra =
    modo === CFG_MLM_LARGA_EPISODIO && !p.fase_motor
      ? { fase_motor: FASE_MOTOR_S_MED_LARGA }
      : {};
  return {
    ...p,
    ...extra,
    nivel_ocupacion_dia_id: String(topes.nivel_ocupacion_dia_id || "").trim() || null,
    politica_superposicion_id: String(topes.politica_superposicion_id || "").trim() || null,
  };
}

module.exports = { enriquecerPayloadMdcDesdeVersion };
