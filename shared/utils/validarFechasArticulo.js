/**
 * Middleware de fechas para solicitudes (casos borde C1, C2, C4).
 * @see docs/v2/CASOS_BORDE_SALDOS_V2.md
 */
import { obtenerYmdHoyInstitucional } from "./fechaInstitucionalBa.js";
import {
  buildIndiceEventosCalendario,
  contarDiasCorridosInclusive,
  contarDiasHabilesDesdeIndice,
  contarDiasHabilesSimpleInclusive,
  fechaHastaPorDiasHabilesDesdeIndice,
  normalizarYmdCalendario,
} from "./calendarInstitucionalCore.js";
import {
  MODO_COMPUTO_CORRIDOS,
  readModoCalculo,
  syncUsaCalendarioInstitucionalEnTopes,
} from "./modoComputoCalendario.js";

export { readModoCalculo, syncUsaCalendarioInstitucionalEnTopes };

export const CODIGO_CRUCE_ANIO = "CRUCE_ANIO_CALENDARIO";
export const CODIGO_HORIZONTE_TEMPORAL = "HORIZONTE_TEMPORAL";
export const CODIGO_INCONSISTENCIA_DIAS_HABILES = "INCONSISTENCIA_DIAS_HABILES";
export const CODIGO_INCONSISTENCIA_DIAS_CORRIDOS = "INCONSISTENCIA_DIAS_CORRIDOS";
export const CODIGO_FECHA_RANGO_INVALIDO = "FECHA_RANGO_INVALIDO";

const MENSAJES = {
  [CODIGO_CRUCE_ANIO]:
    "No podés incluir dos años calendario en la misma solicitud. Emití un ticket por cada año.",
  [CODIGO_HORIZONTE_TEMPORAL]:
    "La fecha elegida supera el horizonte permitido (mes en curso y mes siguiente).",
  [CODIGO_INCONSISTENCIA_DIAS_HABILES]:
    "Los días hábiles del rango no coinciden con lo informado según el calendario institucional.",
  [CODIGO_INCONSISTENCIA_DIAS_CORRIDOS]:
    "Los días corridos del rango no coinciden con la cantidad informada.",
  [CODIGO_FECHA_RANGO_INVALIDO]: "Revisá las fechas del pedido.",
};

/**
 * @param {unknown} code
 */
export function mensajeValidacionFechas(code) {
  return MENSAJES[String(code || "")] || "Revisá las fechas del pedido.";
}

/** @deprecated Usar {@link readModoCalculo}. */
export function readUsaCalendarioInstitucional(versionData) {
  return readModoCalculo(versionData).usaCalendario;
}

/**
 * @param {string} refYmd YYYY-MM-DD (hoy institucional)
 * @returns {string} último día del mes siguiente al de ref
 */
export function ymdFinHorizonteAgenteBase(refYmd) {
  const n = normalizarYmdCalendario(refYmd);
  if (!n) return "";
  const [y, m] = n.split("-").map(Number);
  let ym = m + 1;
  let yy = y;
  if (ym > 12) {
    ym = 1;
    yy += 1;
  }
  const lastDay = new Date(Date.UTC(yy, ym, 0)).getUTCDate();
  return `${yy}-${String(ym).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * @param {string} fechaDesde
 * @param {string} fechaHasta
 */
export function validarCruceAnioCalendario(fechaDesde, fechaHasta) {
  const d = normalizarYmdCalendario(fechaDesde);
  const h = normalizarYmdCalendario(fechaHasta);
  if (!d || !h) return { ok: false, codigo: CODIGO_FECHA_RANGO_INVALIDO };
  if (d.slice(0, 4) !== h.slice(0, 4)) return { ok: false, codigo: CODIGO_CRUCE_ANIO };
  return { ok: true, codigo: null };
}

/**
 * @param {string} fechaDesde
 * @param {string} refYmd
 * @param {{ omitirHorizonte?: boolean }} [opts]
 */
export function validarHorizonteTemporalAgente(fechaDesde, refYmd, opts = {}) {
  if (opts.omitirHorizonte === true) return { ok: true, codigo: null };
  const d = normalizarYmdCalendario(fechaDesde);
  const ref = normalizarYmdCalendario(refYmd) || obtenerYmdHoyInstitucional();
  if (!d) return { ok: false, codigo: CODIGO_FECHA_RANGO_INVALIDO };
  const max = ymdFinHorizonteAgenteBase(ref);
  if (max && d > max) return { ok: false, codigo: CODIGO_HORIZONTE_TEMPORAL };
  return { ok: true, codigo: null };
}

/**
 * @param {{
 *   versionData: Record<string, unknown>,
 *   fechaDesde: string,
 *   fechaHasta: string,
 *   diasSolicitados: number,
 *   refYmd?: string,
 *   omitirHorizonte?: boolean,
 *   indice?: { porYmd: Map<string, unknown>, porMesDia: Map<string, unknown> } | null,
 *   eventosDocs?: Array<{ id: string, data: Record<string, unknown> }>,
 * }} input
 */
export function validarFechasArticulo(input) {
  const versionData = input.versionData || {};
  const fechaDesde = normalizarYmdCalendario(input.fechaDesde);
  let fechaHasta = normalizarYmdCalendario(input.fechaHasta);
  const diasSolicitados = Number.isFinite(Number(input.diasSolicitados))
    ? Math.max(1, Math.floor(Number(input.diasSolicitados)))
    : 1;
  const refYmd = input.refYmd || obtenerYmdHoyInstitucional();
  const modoCalc = readModoCalculo(versionData);
  const { modo, usaCalendario, incluyeFeriadosInstitucionales } = modoCalc;

  const codigos = [];
  const push = (code) => {
    if (code) codigos.push(code);
  };

  if (!fechaDesde) {
    push(CODIGO_FECHA_RANGO_INVALIDO);
    return fail(codigos, fechaDesde, fechaHasta, diasSolicitados, modoCalc);
  }

  let indice =
    input.indice ||
    (Array.isArray(input.eventosDocs) ? buildIndiceEventosCalendario(input.eventosDocs) : null);

  if (usaCalendario) {
    if (!indice) indice = buildIndiceEventosCalendario([]);
    if (!fechaHasta || diasSolicitados > 1) {
      fechaHasta = fechaHastaPorDiasHabilesDesdeIndice(fechaDesde, diasSolicitados, indice, {
        incluyeFeriadosInstitucionales: incluyeFeriadosInstitucionales,
      });
    }
  } else if (!fechaHasta) {
    fechaHasta = fechaDesde;
  }

  if (!fechaHasta || fechaHasta < fechaDesde) {
    push(CODIGO_FECHA_RANGO_INVALIDO);
    return fail(codigos, fechaDesde, fechaHasta, diasSolicitados, modoCalc);
  }

  const cruce = validarCruceAnioCalendario(fechaDesde, fechaHasta);
  if (!cruce.ok) push(cruce.codigo);

  const horizonte = validarHorizonteTemporalAgente(fechaDesde, refYmd, {
    omitirHorizonte: input.omitirHorizonte === true,
  });
  if (!horizonte.ok) push(horizonte.codigo);

  const diasCorridos = contarDiasCorridosInclusive(fechaDesde, fechaHasta);
  let diasHabiles = diasCorridos;

  if (modo === MODO_COMPUTO_CORRIDOS) {
    if (diasCorridos !== diasSolicitados) {
      push(CODIGO_INCONSISTENCIA_DIAS_CORRIDOS);
    }
  } else if (usaCalendario) {
    diasHabiles = incluyeFeriadosInstitucionales
      ? contarDiasHabilesDesdeIndice(fechaDesde, fechaHasta, indice)
      : contarDiasHabilesSimpleInclusive(fechaDesde, fechaHasta);
    if (diasHabiles !== diasSolicitados) {
      push(CODIGO_INCONSISTENCIA_DIAS_HABILES);
    }
  }

  const uniq = [...new Set(codigos)];
  if (uniq.length) {
    return fail(uniq, fechaDesde, fechaHasta, diasSolicitados, modoCalc, diasCorridos, diasHabiles);
  }

  return {
    ok: true,
    codigos: [],
    mensajes: [],
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    dias_solicitados: diasSolicitados,
    modo_computo: modo,
    regla_computo_dias_id: modoCalc.reglaId,
    usa_calendario_institucional: usaCalendario,
    incluye_feriados_institucionales: incluyeFeriadosInstitucionales,
    resumen: {
      dias_corridos: diasCorridos,
      dias_habiles: diasHabiles,
    },
  };
}

function fail(codigos, fechaDesde, fechaHasta, diasSolicitados, modoCalc, diasCorridos = 0, diasHabiles = 0) {
  const uniq = [...new Set(codigos.filter(Boolean))];
  return {
    ok: false,
    codigos: uniq,
    mensajes: uniq.map((c) => mensajeValidacionFechas(c)),
    fecha_desde: fechaDesde || "",
    fecha_hasta: fechaHasta || "",
    dias_solicitados: diasSolicitados,
    modo_computo: modoCalc.modo,
    regla_computo_dias_id: modoCalc.reglaId,
    usa_calendario_institucional: modoCalc.usaCalendario,
    incluye_feriados_institucionales: modoCalc.incluyeFeriadosInstitucionales,
    resumen: {
      dias_corridos: diasCorridos,
      dias_habiles: diasHabiles,
    },
  };
}
