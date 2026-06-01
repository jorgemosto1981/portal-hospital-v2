"use strict";

/**
 * Orquestador generico de motor de solicitudes V2.
 *
 * Ejecuta una secuencia de fases con checks tipados.
 * Si algun check es "bloqueante", el pipeline corta con eligible=false.
 *
 * Tanto LAO (Patron A) como Patron B componen sus fases sobre este runner.
 *
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md
 */

const MOTOR_ORQUESTADOR_VERSION = "motor-orquestador-v1";

/**
 * Ejecuta un pipeline secuencial de fases con early-return en bloqueante.
 *
 * @param {Array<{ id: string, run: (ctx: object) => object | Promise<object> }>} fases
 * @param {object} [ctxInicial]
 * @returns {Promise<{ eligible: boolean, checks: object[], warnings: object[], fase_corte: string|null, ctx: object }>}
 */
async function runMotorPipeline(fases, ctxInicial = {}) {
  const checks = [];
  const warnings = [];
  const ctx = { ...ctxInicial };

  for (const fase of fases) {
    const result = await fase.run(ctx);

    if (result.checks) checks.push(...result.checks);
    if (result.warnings) warnings.push(...result.warnings);
    if (result.data) Object.assign(ctx, result.data);

    const hasBloqueante = (result.checks || []).some((c) => c.nivel === "bloqueante");
    if (hasBloqueante) {
      return { eligible: false, checks, warnings, fase_corte: fase.id, ctx };
    }
  }

  return { eligible: true, checks, warnings, fase_corte: null, ctx };
}

/**
 * @param {string} fase
 * @param {string} codigo
 * @param {"ok"|"bloqueante"|"advertencia"} nivel
 * @param {string} detalle
 */
function motorCheck(fase, codigo, nivel, detalle) {
  return { fase, codigo, nivel, detalle };
}

/**
 * @param {string} codigo
 * @param {string} copy
 * @param {string[]} [campos_origen]
 */
function motorWarning(codigo, copy, campos_origen) {
  return { codigo, copy, ...(campos_origen ? { campos_origen } : {}) };
}

/**
 * @param {object[]} checks
 * @param {string[]} [extra]
 * @returns {string[]}
 */
function mergeMotivosFromChecks(checks, extra = []) {
  const bloqueantes = checks.filter((c) => c.nivel === "bloqueante");
  const msgs = bloqueantes.map((c) => c.detalle).filter(Boolean);
  return [...new Set([...msgs, ...extra].filter(Boolean))];
}

module.exports = {
  MOTOR_ORQUESTADOR_VERSION,
  runMotorPipeline,
  motorCheck,
  motorWarning,
  mergeMotivosFromChecks,
};
