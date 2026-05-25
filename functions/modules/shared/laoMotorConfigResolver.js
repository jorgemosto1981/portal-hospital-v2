"use strict";

/**
 * Resolución de configuración LAO desde documento de versión.
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md
 */

const { PATRON_SALDO_A, resolvePatronSaldo } = require("./resolvePatronSaldo");

const DEFAULT_TSE_MIN = 180;
const DEFAULT_MES_DIA_APERTURA = "07-01";

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error}
 */
function laoMotorError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * @param {object} versionData — doc `cfg_articulos/.../versiones/{ver_id}`
 */
function resolveLaoMotorConfig(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  if (ident.es_lao_anual !== true) {
    throw laoMotorError("ERROR_NO_LAO", "Artículo no configurado como LAO anual.");
  }

  const topes = versionData?.bloque_topes_plazos_computo || {};
  const tseRaw = topes.tse_minimo_dias_base;
  const tseMinimo =
    tseRaw != null && Number.isFinite(Number(tseRaw)) ? Math.max(0, Math.floor(Number(tseRaw))) : DEFAULT_TSE_MIN;

  const mesDiaRaw = String(topes.mes_dia_apertura_solicitudes ?? DEFAULT_MES_DIA_APERTURA).trim();
  const mesDiaApertura = /^\d{2}-\d{2}$/.test(mesDiaRaw) ? mesDiaRaw : DEFAULT_MES_DIA_APERTURA;

  return {
    tseMinimoDiasBase: tseMinimo,
    mesDiaApertura,
    permiteProporcional: topes.permite_calculo_proporcional_tse !== false,
    matrizReglas: Array.isArray(topes.matriz_antiguedad_reglas) ? topes.matriz_antiguedad_reglas : [],
    fechaCorteAntiguedad: topes.fecha_corte_antiguedad ?? null,
    reglaComputoId: topes.regla_computo_dias_id ?? null,
    correspondenciaAnio: topes.correspondencia_anio ?? null,
    diasMinimosPorEvento:
      topes.dias_minimos_por_evento != null && Number.isFinite(Number(topes.dias_minimos_por_evento))
        ? Math.max(0, Math.floor(Number(topes.dias_minimos_por_evento)))
        : null,
  };
}

/**
 * Corte matriz: explícito en versión o 31/12 del ejercicio imputado (RFC v2).
 * @param {object} versionData
 * @param {number} anioImputado
 */
function resolveFechaCorteAntiguedadLao(versionData, anioImputado) {
  const anio = Number(anioImputado);
  if (!Number.isInteger(anio) || anio < 1900) {
    throw laoMotorError("ERROR_ANIO_IMPUTADO", "anio_imputado inválido para corte de antigüedad.");
  }
  const topes = versionData?.bloque_topes_plazos_computo || {};
  const explicit = topes.fecha_corte_antiguedad;
  if (explicit != null && String(explicit).trim()) {
    return String(explicit).trim().slice(0, 10);
  }
  return `${anio}-12-31`;
}

/**
 * @param {unknown[]} hlcArray
 * @returns {string | null} YYYY-MM-DD
 */
function resolveFechaInicioHistoricaHlc(hlcArray) {
  let minUtc = null;
  for (const row of Array.isArray(hlcArray) ? hlcArray : []) {
    if (row?.deshabilitado_en) continue;
    const ymd = String(row?.fecha_inicio ?? row?.fecha_desde ?? "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const t = Date.parse(`${ymd}T12:00:00.000Z`);
    if (!Number.isFinite(t)) continue;
    if (minUtc == null || t < minUtc) minUtc = t;
  }
  if (minUtc == null) return null;
  return new Date(minUtc).toISOString().slice(0, 10);
}

/**
 * Primer día con HLC activo dentro del año civil del ejercicio (proporcional).
 * @param {unknown[]} hlcArray
 * @param {number} anioImputado
 * @returns {string | null} YYYY-MM-DD
 */
function resolveInicioTramoEnAnio(hlcArray, anioImputado) {
  const { buildHlcCoverageIntervalsInWindow } = require("./laoHlcIntervals");
  const anio = Number(anioImputado);
  if (!Number.isInteger(anio)) return null;
  const merged = buildHlcCoverageIntervalsInWindow(hlcArray, `${anio}-01-01`, `${anio}-12-31`);
  if (!merged.length) return null;
  return merged[0].inicioYmd;
}

/**
 * @param {object} versionData
 */
function assertPatronSaldoLAO(versionData) {
  const ident = versionData?.bloque_identidad_naturaleza || {};
  const topes = versionData?.bloque_topes_plazos_computo || {};
  const patron = resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);
  if (patron !== PATRON_SALDO_A) {
    throw laoMotorError(
      "ERROR_PATRON_SALDO_NO_A",
      "La versión LAO debe usar patrón de saldo A (reinicio nunca + origen interno).",
    );
  }
  return patron;
}

/**
 * R3 — mínimo efectivo según saldo de bolsa.
 * @param {{ minConfig: number | null, disponibleBolsa: number }} params
 */
function resolveMinimoDiasEfectivoLao({ minConfig, disponibleBolsa }) {
  const disp = Math.max(0, Math.floor(Number(disponibleBolsa) || 0));
  const minCfg =
    minConfig != null && Number.isFinite(Number(minConfig)) ? Math.max(0, Math.floor(Number(minConfig))) : 0;
  if (disp <= 0) {
    return { minEfectivo: 0, exigeTotalRemanente: false, minConfig: minCfg, disponible: disp };
  }
  if (disp >= minCfg) {
    return { minEfectivo: minCfg, exigeTotalRemanente: false, minConfig: minCfg, disponible: disp };
  }
  return { minEfectivo: disp, exigeTotalRemanente: true, minConfig: minCfg, disponible: disp };
}

/**
 * @param {number} diasSolicitados
 * @param {{ minConfig: number | null, disponibleBolsa: number }} params
 */
function validarDiasMinimosR3(diasSolicitados, params) {
  const dias = Math.floor(Number(diasSolicitados) || 0);
  const { minEfectivo, exigeTotalRemanente, disponible } = resolveMinimoDiasEfectivoLao(params);
  if (exigeTotalRemanente) {
    return dias === disponible
      ? { ok: true }
      : {
          ok: false,
          code: "ERROR_DIAS_MINIMOS",
          detalle: `Saldo remanente ${disponible} días: debe solicitarlos en su totalidad.`,
        };
  }
  if (minEfectivo > 0 && dias < minEfectivo) {
    return {
      ok: false,
      code: "ERROR_DIAS_MINIMOS",
      detalle: `Mínimo ${minEfectivo} días por evento (configuración LAO).`,
    };
  }
  return { ok: true };
}

module.exports = {
  DEFAULT_TSE_MIN,
  DEFAULT_MES_DIA_APERTURA,
  laoMotorError,
  resolveLaoMotorConfig,
  resolveFechaCorteAntiguedadLao,
  resolveFechaInicioHistoricaHlc,
  resolveInicioTramoEnAnio,
  assertPatronSaldoLAO,
  resolveMinimoDiasEfectivoLao,
  validarDiasMinimosR3,
};
