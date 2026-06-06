/** Política GSO mes M-1 solo lectura (espejo backend §18 / O-P1-3). US-8 escenario H. */

export const CODIGO_VENTANA_MES_ANTERIOR = "ASI-GSO-001";
export const CODIGO_PERIODO_CERRADO = "ASI-PER-001";

export const MOTIVO_PERIODO_CERRADO = "periodo_cerrado";
export const MOTIVO_VENTANA_MES_ANTERIOR = "ventana_mes_anterior_dia1";

/** Copy acta GSO — badge celda / acciones de edición (US-8 / P8). */
export const COPY_BADGE_SOLO_LECTURA_GSO = "Mes cerrado / solo lectura";

/** Tarjeta calendario — período cerrado según rol (RRHH no queda en solo lectura). */
export const COPY_TARJETA_PERIODO_CERRADO_JEFE = "Período cerrado · solo lectura";
export const COPY_TARJETA_PERIODO_CERRADO_RRHH =
  "Período cerrado · consulta y gestión RRHH";

/**
 * @param {boolean} [esRrhh]
 */
export function copyTarjetaPeriodoCerrado(esRrhh = false) {
  return esRrhh ? COPY_TARJETA_PERIODO_CERRADO_RRHH : COPY_TARJETA_PERIODO_CERRADO_JEFE;
}

export function periodoActualYm(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function desplazarPeriodoYm(periodoYm, deltaMeses) {
  const [y, m] = String(periodoYm || "").split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + deltaMeses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {string|null|undefined} motivo
 */
export function copyDetalleSoloLecturaGso(motivo) {
  if (motivo === MOTIVO_PERIODO_CERRADO) {
    return "Período de liquidación cerrado para este sector.";
  }
  return "El mes anterior está en solo lectura desde el día 1. Los cambios de turno los gestiona RRHH.";
}

/**
 * @param {string|null|undefined} codigo
 */
export function motivoDesdeCodigoGso(codigo) {
  const c = String(codigo || "").trim();
  if (c === CODIGO_PERIODO_CERRADO) return MOTIVO_PERIODO_CERRADO;
  if (c === CODIGO_VENTANA_MES_ANTERIOR) return MOTIVO_VENTANA_MES_ANTERIOR;
  return null;
}

/**
 * @param {{ codigo?: string|null; escritura_habilitada?: boolean }} [gsoEscritura]
 */
export function soloLecturaDesdeGsoEscrituraApi(gsoEscritura) {
  if (gsoEscritura?.escritura_habilitada === false) {
    const motivo = motivoDesdeCodigoGso(gsoEscritura.codigo);
    return {
      activo: true,
      motivo,
      titulo: COPY_BADGE_SOLO_LECTURA_GSO,
      detalle: copyDetalleSoloLecturaGso(motivo),
    };
  }
  return { activo: false };
}

/**
 * US-8 — hint 🔒 en celda cuando el mes está bloqueado para mutaciones.
 * @param {{ gsoPermiteEscritura?: boolean; motivo?: string|null; tieneDatos?: boolean }} opts
 */
export function evaluarSoloLecturaCeldaGso(opts = {}) {
  if (opts.gsoPermiteEscritura !== false || !opts.tieneDatos) {
    return { activo: false };
  }
  const motivo = opts.motivo || null;
  return {
    activo: true,
    tooltip: COPY_BADGE_SOLO_LECTURA_GSO,
    detalle: copyDetalleSoloLecturaGso(motivo),
    motivo,
  };
}

/**
 * @param {string} periodoYm YYYY-MM consultado en GSO
 * @param {{ esRrhh?: boolean; hoy?: Date }} [opts]
 */
export function evaluarSoloLecturaVentanaGso(periodoYm, opts = {}) {
  if (opts.esRrhh === true) {
    return { solo_lectura: false, codigo: null, mensaje: null, motivo: null };
  }
  const actual = periodoActualYm(opts.hoy || new Date());
  const anterior = desplazarPeriodoYm(actual, -1);
  const solo = String(periodoYm || "").slice(0, 7) === anterior;
  return {
    solo_lectura: solo,
    codigo: solo ? CODIGO_VENTANA_MES_ANTERIOR : null,
    motivo: solo ? MOTIVO_VENTANA_MES_ANTERIOR : null,
    mensaje: solo ? copyDetalleSoloLecturaGso(MOTIVO_VENTANA_MES_ANTERIOR) : null,
  };
}

/**
 * @param {string} periodoYm
 * @param {{ esRrhh?: boolean; periodoCerrado?: boolean }} opts
 */
export function gsoPermiteEscritura(periodoYm, opts = {}) {
  if (opts.esRrhh) return { permite: true, mensaje: null, motivo: null };
  if (opts.periodoCerrado) {
    return {
      permite: false,
      mensaje: copyDetalleSoloLecturaGso(MOTIVO_PERIODO_CERRADO),
      motivo: MOTIVO_PERIODO_CERRADO,
    };
  }
  const ventana = evaluarSoloLecturaVentanaGso(periodoYm, { esRrhh: false });
  if (ventana.solo_lectura) {
    return { permite: false, mensaje: ventana.mensaje, motivo: ventana.motivo };
  }
  return { permite: true, mensaje: null, motivo: null };
}
