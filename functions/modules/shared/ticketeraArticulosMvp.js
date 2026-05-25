"use strict";

/**
 * Catálogo ticketera — discovery dinámico por collectionGroup.
 * Lista vacía → modo "catalogo": levanta todos los artículos con versión publicada,
 * filtrados por patrón válido (B/C), activo, y elegibilidad del agente.
 * @see docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md
 */
const ARTICULO_IDS_MVP = [];

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
