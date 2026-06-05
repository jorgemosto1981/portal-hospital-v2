/** Política GSO mes M-1 solo lectura (espejo backend §18 / O-P1-3). */

export const CODIGO_VENTANA_MES_ANTERIOR = "ASI-GSO-001";

export function periodoActualYm(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function desplazarPeriodoYm(periodoYm, deltaMeses) {
  const [y, m] = String(periodoYm || "").split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {string} periodoYm YYYY-MM consultado en GSO
 * @param {{ esRrhh?: boolean; hoy?: Date }} [opts]
 */
export function evaluarSoloLecturaVentanaGso(periodoYm, opts = {}) {
  if (opts.esRrhh === true) {
    return { solo_lectura: false, codigo: null, mensaje: null };
  }
  const actual = periodoActualYm(opts.hoy || new Date());
  const anterior = desplazarPeriodoYm(actual, -1);
  const solo = String(periodoYm || "").slice(0, 7) === anterior;
  return {
    solo_lectura: solo,
    codigo: solo ? CODIGO_VENTANA_MES_ANTERIOR : null,
    mensaje: solo
      ? "El mes anterior está en solo lectura desde el día 1. Los cambios de turno los gestiona RRHH."
      : null,
  };
}

/**
 * @param {string} periodoYm
 * @param {{ esRrhh?: boolean; periodoCerrado?: boolean }} opts
 */
export function gsoPermiteEscritura(periodoYm, opts = {}) {
  if (opts.esRrhh) return { permite: true, mensaje: null };
  if (opts.periodoCerrado) {
    return {
      permite: false,
      mensaje: "Período de liquidación cerrado para este sector.",
    };
  }
  const ventana = evaluarSoloLecturaVentanaGso(periodoYm, { esRrhh: false });
  if (ventana.solo_lectura) {
    return { permite: false, mensaje: ventana.mensaje };
  }
  return { permite: true, mensaje: null };
}
