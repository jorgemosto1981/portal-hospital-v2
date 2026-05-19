"use strict";

/**
 * Catálogo acotado ticketera Patrón B (ingreso agente).
 * @see docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md
 * Fase 2.5: vaciar lista + flag entorno para “todos Patrón B publicados”.
 */
const ARTICULO_IDS_MVP = [
  "art_01KRNK10V10CH7W5M2W6V558GS", // 64-A con goce
  "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ", // 64-B sin goce
];

const ARTICULO_IDS_MVP_SET = new Set(ARTICULO_IDS_MVP);

module.exports = { ARTICULO_IDS_MVP, ARTICULO_IDS_MVP_SET };
