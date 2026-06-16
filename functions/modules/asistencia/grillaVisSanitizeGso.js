"use strict";

const { resolverFichadaPresencia } = require("../shared/grillaFichadaPresencia");
const { compactarValidacionParaListado } = require("../shared/resolverValidacionFichadaDia");

/** Campos de capa 4 / reloj que GSO jefe no debe recibir por API (UX-6 / §14).
 *  `analitica_cumplimiento` se conserva (minutos de tardanza / ausencia, sin marcas crudas). */
const CAMPOS_SOLO_RRHH_EN_DIA = [
  "fichadas_reales",
  "fichadas",
  "capa_realidad",
  "divergencias",
  "fichadas_borradas",
  "advertencias_fichada_abiertas",
  "resuelto_rrhh",
  "resuelto_rrhh_por_persona_id",
  "resuelto_rrhh_motivo_corto",
  "fichadas_reales_version",
  "estado_fichada_jefe",
  "estado_fichada_jefe_tooltip",
];

/**
 * @param {Record<string, unknown>|null|undefined} cell
 */
function proyectarValidacionFichadaListado(cell) {
  if (!cell || typeof cell !== "object") return null;
  const raw = cell.validacion_fichada_dia;
  if (!raw || typeof raw !== "object") return null;
  return compactarValidacionParaListado(raw);
}

/**
 * @param {object} cell
 */
function sanitizarCeldaDiaGso(cell) {
  if (!cell || typeof cell !== "object") return cell;
  const presencia = resolverFichadaPresencia(cell);
  const out = { ...cell };
  for (const k of CAMPOS_SOLO_RRHH_EN_DIA) {
    if (k in out) delete out[k];
  }
  const validacionListado = proyectarValidacionFichadaListado(cell);
  if (validacionListado) {
    out.validacion_fichada_dia = validacionListado;
  } else if ("validacion_fichada_dia" in out) {
    delete out.validacion_fichada_dia;
  }
  if (presencia != null) {
    out.fichada_presencia = presencia;
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
  proyectarValidacionFichadaListado,
};
