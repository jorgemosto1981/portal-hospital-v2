/** @see docs/v2/RFC_SALDOS_PATRONES_ABC_V2.md §1.3 — SSoT: shared/utils/resolvePatronSaldo.js */
export {
  PATRON_SALDO_A,
  PATRON_SALDO_B,
  PATRON_SALDO_C,
  resolvePatronSaldo,
} from "../../../../shared/utils/resolvePatronSaldo.js";

export function patronSaldoLabel(patron) {
  if (patron === "A") return "A — LAO / bolsas históricas (< A)";
  if (patron === "B") return "B — ciclo anual/mensual (cupo por versión)";
  if (patron === "C") return "C — cuenta continua (saldo informado)";
  return "Sin patrón reconocido — revisar Impacto y saldo en configurador";
}
