"use strict";

/**
 * Callables de lectura de catálogos cfg asistencia/turnos (A0).
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./shared/context");

const COLECCIONES = [
  "cfg_tipo_compensacion_cobertura",
  "cfg_estado_periodo_liquidacion",
  "cfg_clasificacion_dia_calendario",
  "cfg_tipo_override_turno",
];

async function listarColeccionCfg(nombre) {
  const snap = await db.collection(nombre).where("activo", "==", true).get();
  const items = snap.docs
    .map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        codigo_interno: data.codigo_interno || null,
        titulo_ui: data.titulo_ui || data.nombre || d.id,
        orden: typeof data.orden === "number" ? data.orden : 0,
      };
    })
    .sort((a, b) => a.orden - b.orden);
  return items;
}

/**
 * @returns {Promise<import("./asistencia/schemas/cfgAsistenciaTurnos.contract").ListarCatalogosAsistenciaTurnosResponse>}
 */
const listarCatalogosAsistenciaTurnos = onCall({ invoker: "public" }, async () => {
  const out = {};
  for (const col of COLECCIONES) {
    out[col] = await listarColeccionCfg(col);
  }
  return { ok: true, catalogos: out };
});

module.exports = { listarCatalogosAsistenciaTurnos };
