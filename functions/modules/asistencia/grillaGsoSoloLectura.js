"use strict";

/**
 * GSO — mes calendario M-1 solo lectura para usuario/jefe desde día 1 (plan §18, O-P1-3).
 * RRHH con acceso laboral (`tokenHasRrhhLaborAccess`) no aplica la ventana.
 */

const { obtenerYmdHoyInstitucional } = require("../shared/fechaLaboralYmd");
const { tokenHasRrhhLaborAccess } = require("../shared/laborProfile");
const { assertPeriodoNoCerrado, CODIGO_PERIODO_CERRADO, MSG_PERIODO_CERRADO } = require("./asistenciaPeriodoLiquidacion");

const CODIGO_VENTANA_MES_ANTERIOR = "ASI-GSO-001";
const MSG_VENTANA_MES_ANTERIOR =
  "El mes anterior está en solo lectura desde el día 1 del mes en curso. Solo RRHH puede operar cambios de turno en ese período.";

/**
 * @param {string} periodoYm YYYY-MM
 * @param {number} deltaMeses
 */
function desplazarPeriodoYm(periodoYm, deltaMeses) {
  const [y, m] = String(periodoYm || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
  const d = new Date(y, m - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {number} anio
 * @param {number} mes 1-12
 */
function periodoYmDesdeAnioMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/**
 * @param {{ periodoYm: string, hoyYmd?: string, esRrhhLabor?: boolean }} opts
 */
function evaluarPoliticaGsoMes(opts) {
  const periodoYm = String(opts.periodoYm || "").slice(0, 7);
  const hoyYmd = String(opts.hoyYmd || obtenerYmdHoyInstitucional()).slice(0, 10);
  if (opts.esRrhhLabor === true) {
    return {
      solo_lectura: false,
      codigo: null,
      motivo: null,
      periodo_consulta: periodoYm,
      periodo_actual: hoyYmd.slice(0, 7),
    };
  }
  const periodoActual = hoyYmd.slice(0, 7);
  const mesAnterior = desplazarPeriodoYm(periodoActual, -1);
  const soloLectura = Boolean(periodoYm && mesAnterior && periodoYm === mesAnterior);
  return {
    solo_lectura: soloLectura,
    codigo: soloLectura ? CODIGO_VENTANA_MES_ANTERIOR : null,
    motivo: soloLectura ? "ventana_mes_anterior_dia1" : null,
    periodo_consulta: periodoYm,
    periodo_actual: periodoActual,
    periodo_mes_anterior: mesAnterior,
  };
}

/**
 * @param {{ anio: number, mes: number, hoyYmd?: string, esRrhhLabor?: boolean }} opts
 */
function evaluarPoliticaGsoAnioMes(opts) {
  return evaluarPoliticaGsoMes({
    periodoYm: periodoYmDesdeAnioMes(opts.anio, opts.mes),
    hoyYmd: opts.hoyYmd,
    esRrhhLabor: opts.esRrhhLabor,
  });
}

/**
 * @param {{ fechaYmd: string, hoyYmd?: string, esRrhhLabor?: boolean, periodoCerrado?: boolean }} opts
 */
function resolverEscrituraGsoDia(opts) {
  if (opts.esRrhhLabor === true) {
    return { escritura_habilitada: true, codigo: null, mensaje: null, politica_mes: null };
  }
  if (opts.periodoCerrado === true) {
    return {
      escritura_habilitada: false,
      codigo: CODIGO_PERIODO_CERRADO,
      mensaje: MSG_PERIODO_CERRADO,
      politica_mes: null,
    };
  }
  const politica = evaluarPoliticaGsoMes({
    periodoYm: String(opts.fechaYmd || "").slice(0, 7),
    hoyYmd: opts.hoyYmd,
    esRrhhLabor: false,
  });
  if (politica.solo_lectura) {
    return {
      escritura_habilitada: false,
      codigo: CODIGO_VENTANA_MES_ANTERIOR,
      mensaje: MSG_VENTANA_MES_ANTERIOR,
      politica_mes: politica,
    };
  }
  return { escritura_habilitada: true, codigo: null, mensaje: null, politica_mes: politica };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} firestore
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId
 * @param {import("firebase-functions/v2/https").DecodedIdToken|Record<string, unknown>|null|undefined} [token]
 */
async function assertGrillaGsoEscrituraEnFecha(firestore, personaId, fechaYmd, grupoTrabajoId, token) {
  const esRrhhLabor = tokenHasRrhhLaborAccess(token);

  try {
    await assertPeriodoNoCerrado(firestore, personaId, fechaYmd, grupoTrabajoId);
  } catch (e) {
    const err = new Error((e && e.message) || MSG_PERIODO_CERRADO);
    err.code = "failed-precondition";
    throw err;
  }

  const gate = resolverEscrituraGsoDia({
    fechaYmd,
    esRrhhLabor,
    periodoCerrado: false,
  });
  if (!gate.escritura_habilitada) {
    const err = new Error(`[${gate.codigo}] ${gate.mensaje}`);
    err.code = "failed-precondition";
    throw err;
  }
}

module.exports = {
  CODIGO_VENTANA_MES_ANTERIOR,
  MSG_VENTANA_MES_ANTERIOR,
  desplazarPeriodoYm,
  periodoYmDesdeAnioMes,
  evaluarPoliticaGsoMes,
  evaluarPoliticaGsoAnioMes,
  resolverEscrituraGsoDia,
  assertGrillaGsoEscrituraEnFecha,
};
