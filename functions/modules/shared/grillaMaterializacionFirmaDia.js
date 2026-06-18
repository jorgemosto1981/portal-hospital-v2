"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Huella estable de capa teórica materializada (sin I/O).
 * Usada para detectar desalineación persistida vs motor unificado.
 */

/**
 * @param {Record<string, unknown>|null|undefined} capa
 * @returns {string}
 */
function firmaCapaTeoricaMaterializada(capa) {
  if (!capa || typeof capa !== "object") return "vacio";
  const tipo = String(capa.tipo_dia || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const segs = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  const ids = segs
    .map((s) => String(s?.segmento_id || "").trim())
    .filter(Boolean)
    .sort()
    .join(",");
  const comp = String(capa.turno_compuesto_id || capa.turno_id || "").trim();
  const franco = capa.tipo_dia === "franco" || tipo === "franco" ? "1" : "0";
  return `${tipo}|fr:${franco}|${comp}|${ids}`;
}

/**
 * @param {string|null|undefined} firmaPersistida
 * @param {string|null|undefined} firmaEsperada
 * @returns {{ desalineado: boolean; firma_persistida: string; firma_esperada: string }}
 */
function evaluarDesalineacionFirmaMaterializacion(firmaPersistida, firmaEsperada) {
  const p = String(firmaPersistida || "vacio");
  const e = String(firmaEsperada || "vacio");
  return {
    desalineado: p !== e,
    firma_persistida: p,
    firma_esperada: e,
  };
}

module.exports = { firmaCapaTeoricaMaterializada, evaluarDesalineacionFirmaMaterializacion };
