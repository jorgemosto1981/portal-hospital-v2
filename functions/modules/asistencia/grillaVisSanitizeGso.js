"use strict";

/** Campos de capa 4 / reloj que GSO jefe no debe recibir por API (UX-6). */
const CAMPOS_SOLO_RRHH_EN_DIA = [
  "fichadas_reales",
  "fichadas",
  "capa_realidad",
  "divergencias",
];

function sanitizarCeldaDiaGso(cell) {
  if (!cell || typeof cell !== "object") return cell;
  const out = { ...cell };
  for (const k of CAMPOS_SOLO_RRHH_EN_DIA) {
    if (k in out) delete out[k];
  }
  return out;
}

/**
 * Filtra respuesta grilla para rol jefe/usuario (no RRHH labor).
 * @param {Record<string, unknown>} dias
 */
function sanitizarDiasVisGso(dias) {
  if (!dias || typeof dias !== "object") return dias || {};
  const out = {};
  for (const [key, cell] of Object.entries(dias)) {
    out[key] = sanitizarCeldaDiaGso(cell);
  }
  return out;
}

/**
 * @param {object} vista — resultado de grillaMesAgenteCore
 * @returns {object}
 */
function sanitizarVistaGrillaMesAgenteGso(vista) {
  if (!vista || typeof vista !== "object") return vista;
  return {
    ...vista,
    dias: sanitizarDiasVisGso(vista.dias),
  };
}

/**
 * @param {object} result — listarVistaGrillaMesPorGrupo
 * @returns {object}
 */
function sanitizarListadoGrillaGrupoGso(result) {
  if (!result || typeof result !== "object") return result;
  const filas = Array.isArray(result.filas)
    ? result.filas.map((f) => ({
      ...f,
      dias: sanitizarDiasVisGso(f.dias),
    }))
    : result.filas;
  return { ...result, filas };
}

module.exports = {
  sanitizarDiasVisGso,
  sanitizarVistaGrillaMesAgenteGso,
  sanitizarListadoGrillaGrupoGso,
  CAMPOS_SOLO_RRHH_EN_DIA,
};
