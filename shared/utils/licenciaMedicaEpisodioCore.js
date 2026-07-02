/**
 * Motor episodio continuo — licencia médica larga (Arts. 16/19, cfg_mlm_larga_episodio).
 * @see docs/v2/RFC_P4_LICENCIAS_MEDICAS_ART_11_14_V2.md §4.4
 */

import {
  CFG_MLM_LARGA_EPISODIO,
  leerModoLicenciaMedicaDesdeVersion,
} from "./licenciaMedicaTramosCore.js";

/** Tope normativo V2 mínimo: ~2 años corridos de episodio continuo (730 días). */
export const TOPE_EPISODIO_DIAS_CONTINUOS = 730;

/** Identificador de fase motor en preview / `licencia_medica` (grilla y orquestación). */
export const FASE_MOTOR_S_MED_LARGA = "S_MED_LARGA";

/**
 * @param {string} ymd
 * @param {number} deltaDays
 */
export function ymdAddDays(ymd, deltaDays) {
  const m = String(ymd).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error("ymd inválido");
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * @param {string} desdeYmd
 * @param {string} hastaYmd
 */
function diasCorridosInclusive(desdeYmd, hastaYmd) {
  const desde = String(desdeYmd).slice(0, 10);
  const hasta = String(hastaYmd).slice(0, 10);
  if (hasta < desde) return 0;
  let n = 0;
  let cur = desde;
  while (cur <= hasta) {
    n += 1;
    if (cur === hasta) break;
    cur = ymdAddDays(cur, 1);
  }
  return n;
}

/**
 * @param {Array<{ fecha_desde?: string, fecha_hasta?: string }>} periodos
 */
function fusionarPeriodosContiguos(periodos) {
  const rows = periodos
    .map((p) => ({
      fecha_desde: String(p.fecha_desde || "").slice(0, 10),
      fecha_hasta: String(p.fecha_hasta || "").slice(0, 10),
    }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_desde) && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha_hasta))
    .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));

  /** @type {Array<{ fecha_desde: string, fecha_hasta: string }>} */
  const merged = [];
  for (const p of rows) {
    if (!merged.length) {
      merged.push({ ...p });
      continue;
    }
    const last = merged[merged.length - 1];
    const limiteUnion = ymdAddDays(last.fecha_hasta, 1);
    if (p.fecha_desde <= limiteUnion) {
      if (p.fecha_hasta > last.fecha_hasta) last.fecha_hasta = p.fecha_hasta;
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
}

/**
 * Días ya aprobados en el episodio continuo que enlaza con el inicio de la nueva solicitud.
 * No usa año calendario; solo continuidad de rangos (sin `episodio_seguimiento_id` en V2).
 *
 * @param {Array<{ fecha_desde?: string, fecha_hasta?: string }>} periodosAprobados
 * @param {string} fechaDesdeNueva
 */
export function calcularConsumoPrevioEpisodioContinuo(periodosAprobados, fechaDesdeNueva) {
  const fd = String(fechaDesdeNueva || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fd)) return 0;
  const diaAntes = ymdAddDays(fd, -1);
  const merged = fusionarPeriodosContiguos(periodosAprobados);

  for (const block of merged) {
    if (block.fecha_hasta < diaAntes) continue;
    if (block.fecha_desde > fd) continue;
    const hastaConsumo = block.fecha_hasta < diaAntes ? block.fecha_hasta : diaAntes;
    if (hastaConsumo < block.fecha_desde) continue;
    return diasCorridosInclusive(block.fecha_desde, hastaConsumo);
  }
  return 0;
}

/**
 * @param {unknown} versionData
 */
export function esLicenciaMedicaLargaEpisodio(versionData) {
  return leerModoLicenciaMedicaDesdeVersion(versionData) === CFG_MLM_LARGA_EPISODIO;
}

/**
 * @param {unknown} licenciaMedica
 * @param {{ dictamen_favorable?: unknown }} [extra]
 */
export function tieneDictamenFavorableLarga(licenciaMedica, extra) {
  if (extra?.dictamen_favorable === true) return true;
  if (!licenciaMedica || typeof licenciaMedica !== "object") return false;
  const lm = /** @type {Record<string, unknown>} */ (licenciaMedica);
  if (lm.dictamen_favorable === true) return true;
  const dictamen = lm.dictamen;
  if (dictamen && typeof dictamen === "object" && dictamen.favorable === true) return true;
  return false;
}

/**
 * @param {{ consumido_previo_episodio?: unknown, dias_solicitados?: unknown }} params
 */
export function proyectarEpisodioContinuo(params) {
  const consumido_previo_episodio = normalizarEnteroNoNegativo(params?.consumido_previo_episodio);
  const dias_solicitados = normalizarEnteroPositivo(params?.dias_solicitados);
  if (consumido_previo_episodio == null) {
    throw new Error("consumido_previo_episodio debe ser un entero >= 0");
  }
  if (dias_solicitados == null) {
    throw new Error("dias_solicitados debe ser un entero >= 1");
  }

  const total_episodio_post = consumido_previo_episodio + dias_solicitados;
  const dias_disponibles_tope = Math.max(0, TOPE_EPISODIO_DIAS_CONTINUOS - consumido_previo_episodio);

  return {
    consumido_previo_episodio,
    dias_solicitados,
    dias_solicitud_total: dias_solicitados,
    total_episodio_post,
    excede_tope_continuo: total_episodio_post > TOPE_EPISODIO_DIAS_CONTINUOS,
    dias_disponibles_tope,
    tope_episodio_dias: TOPE_EPISODIO_DIAS_CONTINUOS,
  };
}

/**
 * @param {{
 *   modo_licencia_medica_id?: string,
 *   consumido_previo_episodio: number,
 *   dias_solicitados: number,
 *   causal_larga_duracion_id?: string | null,
 *   requiere_dictamen?: boolean,
 *   dictamen_favorable?: boolean,
 * }} input
 */
export function buildLicenciaMedicaPreviewLarga(input) {
  const calc = proyectarEpisodioContinuo({
    consumido_previo_episodio: input.consumido_previo_episodio,
    dias_solicitados: input.dias_solicitados,
  });

  const partes = [];
  if (input.dictamen_favorable !== true && input.requiere_dictamen !== false) {
    partes.push("Requiere dictamen médico favorable antes de avanzar en el circuito.");
  }
  if (calc.excede_tope_continuo) {
    partes.push(
      `El episodio continuo superaría el tope de ${TOPE_EPISODIO_DIAS_CONTINUOS} días (${calc.total_episodio_post} días proyectados).`,
    );
  } else {
    partes.push(
      `Episodio continuo: ${calc.dias_solicitados} día${calc.dias_solicitados === 1 ? "" : "s"} en esta solicitud (${calc.total_episodio_post} acumulados en el episodio).`,
    );
    if (calc.dias_disponibles_tope > 0) {
      partes.push(`Quedan hasta ${calc.dias_disponibles_tope} día${calc.dias_disponibles_tope === 1 ? "" : "s"} dentro del tope continuo.`);
    }
  }

  return {
    schema_version: 1,
    fase_motor: FASE_MOTOR_S_MED_LARGA,
    modo_licencia_medica_id: input.modo_licencia_medica_id || CFG_MLM_LARGA_EPISODIO,
    causal_larga_duracion_id: input.causal_larga_duracion_id ?? null,
    consumido_previo_episodio: calc.consumido_previo_episodio,
    dias_solicitud_total: calc.dias_solicitud_total,
    total_episodio_post: calc.total_episodio_post,
    excede_tope_continuo: calc.excede_tope_continuo,
    dias_disponibles_tope: calc.dias_disponibles_tope,
    tope_episodio_dias: calc.tope_episodio_dias,
    requiere_dictamen: input.requiere_dictamen !== false,
    dictamen_favorable: input.dictamen_favorable === true,
    tramos_haberes: null,
    mensaje_ui: partes.join(" "),
    mensaje_ui_corto: calc.excede_tope_continuo
      ? "Excede tope episodio"
      : `${calc.dias_solicitados} días · episodio ${calc.total_episodio_post}/${TOPE_EPISODIO_DIAS_CONTINUOS}`,
  };
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function normalizarEnteroNoNegativo(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function normalizarEnteroPositivo(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
