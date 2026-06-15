"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Lectura de celdas vis_* fusionando claves planas legacy `dias.18.campo`.
 * @param {Record<string, unknown>} data
 */
function fusionarDiasDesdeClavesPlanas(data) {
  const dias = data.dias && typeof data.dias === "object" ? { ...data.dias } : {};
  for (const [key, value] of Object.entries(data)) {
    const m = key.match(/^dias\.(\d+)\.(.+)$/);
    if (!m) continue;
    const dk = m[1];
    const field = m[2];
    if (!dias[dk] || typeof dias[dk] !== "object") dias[dk] = {};
    const actual = dias[dk][field];
    if (actual === undefined || actual === null) {
      dias[dk][field] = value;
    }
  }
  return dias;
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} diaKey
 */
function leerCeldaVisDiaFusionada(data, diaKey) {
  const dk = String(diaKey || "").trim();
  if (!dk || !data || typeof data !== "object") return {};
  const dias = fusionarDiasDesdeClavesPlanas(data);
  const celda = dias[dk];
  return celda && typeof celda === "object" ? celda : {};
}

module.exports = { fusionarDiasDesdeClavesPlanas, leerCeldaVisDiaFusionada };
