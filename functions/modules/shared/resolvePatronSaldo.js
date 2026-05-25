"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/** @see docs/v2/RFC_SALDOS_PATRONES_ABC_V2.md §1.3 */

const PATRON_SALDO_A = "A";
const PATRON_SALDO_B = "B";
const PATRON_SALDO_C = "C";

const RCC_CICLICOS = new Set(["cfg_rcc_anual", "cfg_rcc_mensual", "cfg_rcc_diario"]);
const OS_EXTERNO = new Set(["cfg_os_externo_informado", "cfg_os_externo_calculado"]);

/**
 * @param {string | null | undefined} reinicioCicloId
 * @param {string | null | undefined} origenSaldoId
 * @param {boolean} esLaoAnual
 * @returns {'A'|'B'|'C'|null}
 */
function resolvePatronSaldo(reinicioCicloId, origenSaldoId, esLaoAnual) {
  const r = String(reinicioCicloId || "").trim();
  const o = String(origenSaldoId || "").trim();
  if (RCC_CICLICOS.has(r)) return PATRON_SALDO_B;
  if (r === "cfg_rcc_nunca" && o === "cfg_os_interno") {
    return esLaoAnual === true ? PATRON_SALDO_A : null;
  }
  if (r === "cfg_rcc_nunca" && OS_EXTERNO.has(o)) return PATRON_SALDO_C;
  return null;
}

module.exports = { PATRON_SALDO_A, PATRON_SALDO_B, PATRON_SALDO_C, resolvePatronSaldo };
