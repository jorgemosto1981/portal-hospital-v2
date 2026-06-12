"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const {
  celdaEsperaFichada,
  celdaTieneCapaFichadaCargada,
  celdaTieneFichadaImpar,
  celdaTieneRegistroFichada,
  parseFichadasRealesCelda,
} = require("./grillaFichadaPresencia");

/**
 * §14 — Semáforo lógico fichada para grilla Jefe (sin horas crudas).
 */

const ESTADO_FICHADA_JEFE = {
  ALERTA: "ALERTA",
  RRHH_PENDIENTE: "RRHH_PENDIENTE",
  RRHH_RESUELTO: "RRHH_RESUELTO",
  OK: "OK",
};

const TOOLTIPS = {
  ALERTA: "Incumplimiento o fichada incompleta — requiere revisión",
  RRHH_PENDIENTE: "Auditoría RRHH pendiente (advertencias abiertas)",
  RRHH_RESUELTO: "Revisado y saneado por RRHH",
  OK: "Asistencia conforme",
};

/**
 * @param {string} estado
 */
function tooltipEstadoFichadaJefe(estado) {
  return TOOLTIPS[estado] || TOOLTIPS.OK;
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {object} [context]
 * @param {boolean} [context.tiene_licencia_justifica_ausencia]
 * @param {boolean} [context.ventana_nocturnidad_cerrada]
 */
function evaluarEstadoFichadaJefe(celda, context = {}) {
  if (!celda || typeof celda !== "object") {
    return { estado_fichada_jefe: ESTADO_FICHADA_JEFE.OK, tooltip: TOOLTIPS.OK };
  }

  const advertencias = Array.isArray(celda.advertencias_fichada_abiertas)
    ? celda.advertencias_fichada_abiertas.filter(Boolean)
    : [];
  const tieneLicencia = context.tiene_licencia_justifica_ausencia === true;
  const ventanaCerrada = context.ventana_nocturnidad_cerrada !== false;

  const espera = celdaEsperaFichada(celda);
  const tieneRegistro = celdaTieneRegistroFichada(celda);
  const impar = celdaTieneFichadaImpar(celda);
  const capaCargada = celdaTieneCapaFichadaCargada(celda);
  const sinMarcas = capaCargada && parseFichadasRealesCelda(celda).length === 0;

  const alertaNocturnidad =
    ventanaCerrada && espera && !tieneLicencia && (sinMarcas || impar);

  if (alertaNocturnidad) {
    return {
      estado_fichada_jefe: ESTADO_FICHADA_JEFE.ALERTA,
      tooltip: TOOLTIPS.ALERTA,
    };
  }

  if (advertencias.length > 0) {
    return {
      estado_fichada_jefe: ESTADO_FICHADA_JEFE.RRHH_PENDIENTE,
      tooltip: `${TOOLTIPS.RRHH_PENDIENTE}: ${advertencias.slice(0, 3).join(", ")}`,
    };
  }

  if (celda.resuelto_rrhh === true) {
    return {
      estado_fichada_jefe: ESTADO_FICHADA_JEFE.RRHH_RESUELTO,
      tooltip: TOOLTIPS.RRHH_RESUELTO,
    };
  }

  return {
    estado_fichada_jefe: ESTADO_FICHADA_JEFE.OK,
    tooltip: TOOLTIPS.OK,
  };
}

module.exports = { ESTADO_FICHADA_JEFE, tooltipEstadoFichadaJefe, evaluarEstadoFichadaJefe };
