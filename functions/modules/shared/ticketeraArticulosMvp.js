"use strict";

/**
 * Catálogo acotado ticketera Patrón B (ingreso agente).
 * @see docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md
 * Fase 2.5: `TICKETERA_LISTAR_TODOS_PATRON_B=1` o lista vacía → discovery por collectionGroup.
 */
const ARTICULO_IDS_MVP = [
  "art_01KRNK10V10CH7W5M2W6V558GS", // 64-A con goce
  "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ", // 64-B sin goce
];

const ARTICULO_IDS_MVP_SET = new Set(ARTICULO_IDS_MVP);

/**
 * Modo listado según RFC Fase 2 §2.3.
 * @returns {"mvp" | "catalogo"}
 */
function modoListadoArticulosIngreso() {
  const env = String(process.env.TICKETERA_LISTAR_TODOS_PATRON_B || "")
    .trim()
    .toLowerCase();
  if (env === "1" || env === "true" || env === "yes") return "catalogo";
  if (ARTICULO_IDS_MVP.length === 0) return "catalogo";
  return "mvp";
}

function usaCatalogoPatronBCompleto() {
  return modoListadoArticulosIngreso() === "catalogo";
}

module.exports = {
  ARTICULO_IDS_MVP,
  ARTICULO_IDS_MVP_SET,
  modoListadoArticulosIngreso,
  usaCatalogoPatronBCompleto,
};
