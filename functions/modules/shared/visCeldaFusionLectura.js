"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { envelopeTeoricoDesdeCapa } = require("./capaTeoricaLimitesCumplimiento");

/**
 * Lectura de celdas vis_* fusionando claves planas legacy `dias.18.campo`.
 * @param {Record<string, unknown>} data
 */
function fusionarDiasDesdeClavesPlanas(data) {
  const dias = data.dias && typeof data.dias === "object" ? { ...data.dias } : {};
  for (const [key, value] of Object.entries(data)) {
    const m = key.match(/^dias\.(\d+)\.(.+)$/);
    if (!m) continue;
    const dk = m[1];
    const field = m[2];
    if (!dias[dk] || typeof dias[dk] !== "object") dias[dk] = {};
    const nestedCelda = data.dias?.[dk];
    if (
      nestedCelda
      && typeof nestedCelda === "object"
      && Object.prototype.hasOwnProperty.call(nestedCelda, field)
      && (field === "analitica_cumplimiento" || field === "validacion_fichada_dia")
    ) {
      continue;
    }
    // Las actualizaciones por dot-path (`dias.14.campo` en la raíz del doc) son la fuente vigente.
    dias[dk][field] = value;
  }
  return dias;
}

/**
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} diaKey
 */
function leerCeldaVisDiaFusionada(data, diaKey) {
  const dk = String(diaKey || "").trim();
  if (!dk || !data || typeof data !== "object") return {};
  const dias = fusionarDiasDesdeClavesPlanas(data);
  const celda = dias[dk];
  return celda && typeof celda === "object" ? celda : {};
}

/**
 * Sub-objeto materializado `presentacion_compuesto` (RFC filas celda).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {{ version?: number|null, turno_compuesto_id?: string|null, filas: Array<Record<string, unknown>> }|null}
 */
function leerPresentacionCompuestoDesdeCelda(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return null;
  const raw = celdaVis.presentacion_compuesto;
  if (!raw || typeof raw !== "object") return null;
  const filas = Array.isArray(raw.filas)
    ? raw.filas.filter((f) => f && typeof f === "object")
    : [];
  if (!filas.length) return null;
  return {
    version: raw.version ?? null,
    turno_compuesto_id: raw.turno_compuesto_id ?? null,
    filas,
  };
}

/**
 * Filas listas para iterar en UI (array vacío si no hay matriz compuesta).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {Array<Record<string, unknown>>}
 */
function filasPresentacionCompuestoDesdeCelda(celdaVis) {
  return leerPresentacionCompuestoDesdeCelda(celdaVis)?.filas ?? [];
}

function leerTurnoCompuestoIdPresentacionRaw(celdaVis) {
  const raw = celdaVis?.presentacion_compuesto;
  if (!raw || typeof raw !== "object") return "";
  return String(raw.turno_compuesto_id || "").trim();
}

function celdaVisSinHorarioOperativo(celdaVis) {
  const ing = String(celdaVis?.rda_ingreso || "").trim();
  const egr = String(celdaVis?.rda_egreso || "").trim();
  return !ing && !egr;
}

function celdaVisSinSegmentosNiFilasOperativas(celdaVis) {
  const pres = leerPresentacionCompuestoDesdeCelda(celdaVis);
  if (pres?.filas?.length) return false;
  const rawPres = celdaVis?.presentacion_compuesto;
  if (rawPres && typeof rawPres === "object" && Array.isArray(rawPres.filas) && rawPres.filas.length > 0) {
    return false;
  }
  const capa = celdaVis?.capa_teorica;
  if (capa && typeof capa === "object") {
    const segs = Array.isArray(capa.segmentos) ? capa.segmentos : [];
    if (segs.length > 0) return false;
  }
  return true;
}

/**
 * Tras traslados sucesivos: `rda_turno_id` o `turno_compuesto_id` sin filas ni horario (saldo cero).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
function celdaVisTokenTeoricoSinSaldoOperativo(celdaVis) {
  if (!celdaVisSinHorarioOperativo(celdaVis)) return false;
  if (!celdaVisSinSegmentosNiFilasOperativas(celdaVis)) return false;
  const rda = String(celdaVis.rda_turno_id || "").trim();
  const comp = leerTurnoCompuestoIdPresentacionRaw(celdaVis);
  const token = rda || comp;
  if (!token || token === "F" || token === "NL") return false;
  return true;
}

/**
 * Día sin turno teórico operativo (franco explícito).
 * Si hay `rda_turno_id`, segmentos en capa o filas de presentación, no es franco
 * aunque queden flags `es_franco` / `tipo_dia: franco` obsoletos (p. ej. incorporar N en día plan franco).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
function celdaVisIndicaFrancoOperativo(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return false;

  if (celdaVisTokenTeoricoSinSaldoOperativo(celdaVis)) return true;

  const rda = String(celdaVis.rda_turno_id || "").trim();
  if (rda && rda !== "F") return false;

  const pres = leerPresentacionCompuestoDesdeCelda(celdaVis);
  if (pres?.filas?.length) return false;

  const capa = celdaVis.capa_teorica;
  if (capa && typeof capa === "object") {
    const segs = Array.isArray(capa.segmentos) ? capa.segmentos : [];
    if (segs.length > 0) return false;
  }

  if (
    celdaVisSinHorarioOperativo(celdaVis)
    && celdaVisSinSegmentosNiFilasOperativas(celdaVis)
    && (celdaVis.es_franco === true || String(celdaVis.tipo_dia || "").trim().toLowerCase() === "franco")
  ) {
    return true;
  }
  if (celdaVis.es_franco === true) return true;
  const tipo = String(celdaVis.tipo_dia || "").trim().toLowerCase();
  if (tipo === "franco") return true;
  if (capa && typeof capa === "object") {
    if (capa.es_franco === true) return true;
    if (String(capa.tipo_dia || "").trim().toLowerCase() === "franco") return true;
  }
  return rda === "F";
}

/**
 * Limpia turno/presentación obsoletos cuando la celda ya es franco (tras traslados sucesivos).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
function coherirCeldaVisTeoriaFranco(celdaVis) {
  if (!celdaVisIndicaFrancoOperativo(celdaVis)) return celdaVis;
  const capaRaw = celdaVis.capa_teorica;
  const capa = capaRaw && typeof capaRaw === "object"
    ? { ...capaRaw, tipo_dia: "franco", es_franco: true, segmentos: [] }
    : { tipo_dia: "franco", es_franco: true, segmentos: [] };
  const next = {
    ...celdaVis,
    es_franco: true,
    tipo_dia: "franco",
    rda_turno_id: "",
    rda_ingreso: null,
    rda_egreso: null,
    rda_horario_display: null,
    capa_teorica: capa,
    presentacion_compuesto: { filas: [] },
    fichadas_esperadas: 0,
  };
  delete next.analitica_cumplimiento;
  delete next.validacion_fichada_dia;
  return next;
}

/**
 * Tramos que el teórico de la celda exige hoy (`rda_turno_id` / presentación).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @returns {Set<string>|null}
 */
function idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return null;
  if (celdaVisIndicaFrancoOperativo(celdaVis)) return new Set();
  const pres = leerPresentacionCompuestoDesdeCelda(celdaVis);
  const tid = String(celdaVis.rda_turno_id || pres?.turno_compuesto_id || "").trim();
  if (!tid) return null;
  if (!tid.includes("+")) {
    const one = /^[MTN]$/i.test(tid) ? tid.toUpperCase() : tid;
    return new Set([one]);
  }
  return new Set(tid.split("+").map((s) => s.trim()).filter(Boolean));
}

/**
 * Quita filas de tramos ya no teóricos (p. ej. T tras traslado origen 06→05).
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Array<Record<string, unknown>>} filas
 */
function filtrarFilasPresentacionAlTeoricoOperativo(celdaVis, filas) {
  if (!Array.isArray(filas) || !filas.length) return filas;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return filas;
  const filtered = filas.filter((f) => ids.has(String(f?.segmento_id || "").trim()));
  return filtered.length ? filtered : filas;
}

/**
 * Alinea `capa.segmentos` al turno operativo de la celda (`rda_turno_id` / presentación).
 * Evita analítica y presentación con tramos obsoletos tras traslado origen (p. ej. T en día solo-M).
 *
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Record<string, unknown>|null|undefined} capa
 */
function alinearCapaSegmentosAlTeoricoVis(celdaVis, capa) {
  if (!capa || typeof capa !== "object") return capa;
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (segmentos.length < 2) return capa;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return capa;
  const filtered = segmentos.filter((s) => ids.has(String(s?.segmento_id || "").trim()));
  if (!filtered.length || filtered.length === segmentos.length) return capa;

  const rda = String(celdaVis?.rda_turno_id || "").trim();
  const turno_compuesto_id = rda
    || (filtered.length > 1
      ? filtered.map((s) => String(s?.segmento_id || "").trim()).filter(Boolean).join("+")
      : String(filtered[0]?.segmento_id || "").trim())
    || capa.turno_compuesto_id;

  const next = {
    ...capa,
    segmentos: filtered,
    turno_compuesto_id,
    ...(filtered.length === 1 ? { turno_id: filtered[0].segmento_id } : {}),
  };
  const env = envelopeTeoricoDesdeCapa(next);
  if (env.ingreso_teorico_final) {
    next.ingreso_teorico_final = env.ingreso_teorico_final;
    next.egreso_teorico_final = env.egreso_teorico_final;
  }
  if (env.horas_desde_segmentos != null) {
    next.horas_teoricas_totales = env.horas_desde_segmentos;
  }
  return next;
}

/**
 * Quita `es_franco` / `tipo_dia: franco` en raíz o capa si el teórico operativo ya tiene turno.
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
function alinearFlagsTipoDiaAlTeoricoOperativo(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return celdaVis;
  if (celdaVisIndicaFrancoOperativo(celdaVis)) return celdaVis;
  let next = celdaVis;
  const touchRoot = celdaVis.es_franco === true
    || String(celdaVis.tipo_dia || "").trim().toLowerCase() === "franco";
  const capa = celdaVis.capa_teorica;
  const touchCapa = capa && typeof capa === "object"
    && (capa.es_franco === true || String(capa.tipo_dia || "").trim().toLowerCase() === "franco");
  if (!touchRoot && !touchCapa) return celdaVis;
  next = { ...celdaVis };
  if (touchRoot) {
    next.es_franco = false;
    if (String(next.tipo_dia || "").trim().toLowerCase() === "franco") {
      next.tipo_dia = "laborable";
    }
  }
  if (touchCapa && capa && typeof capa === "object") {
    const c = { ...capa, es_franco: false };
    if (String(c.tipo_dia || "").trim().toLowerCase() === "franco") {
      c.tipo_dia = "laborable";
    }
    next.capa_teorica = c;
  }
  return next;
}

/**
 * Recorta `presentacion_compuesto` y `capa_teorica.segmentos` al teórico operativo (`rda_turno_id`).
 * Tras traslados sucesivos el worker a veces deja filas M/T obsoletas con `rda` ya reducido (p. ej. solo N).
 *
 * @param {Record<string, unknown>|null|undefined} celdaVis
 */
function coherirPresentacionCompuestoAlTeoricoVis(celdaVis) {
  if (!celdaVis || typeof celdaVis !== "object") return celdaVis;
  if (celdaVisIndicaFrancoOperativo(celdaVis)) return coherirCeldaVisTeoriaFranco(celdaVis);

  let next = celdaVis;
  const pres = leerPresentacionCompuestoDesdeCelda(next);
  if (pres?.filas?.length) {
    const filtered = filtrarFilasPresentacionAlTeoricoOperativo(next, pres.filas);
    if (filtered.length && filtered.length < pres.filas.length) {
      const rda = String(next.rda_turno_id || "").trim();
      next = {
        ...next,
        presentacion_compuesto: {
          ...pres,
          turno_compuesto_id: rda || pres.turno_compuesto_id,
          filas: filtered,
        },
      };
    }
  }
  const capa = next.capa_teorica;
  if (capa && typeof capa === "object") {
    const aligned = alinearCapaSegmentosAlTeoricoVis(next, capa);
    if (aligned !== capa) next = { ...next, capa_teorica: aligned };
  }
  return next;
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {Array<Record<string, unknown>>|undefined} segmentos
 */
function filtrarSegmentosCumplimientoAlTeoricoVis(celdaVis, segmentos) {
  if (!Array.isArray(segmentos) || !segmentos.length) return segmentos;
  const ids = idsSegmentoTeoricoOperativoDesdeCeldaVis(celdaVis);
  if (!ids?.size) return segmentos;
  const filtered = segmentos.filter((s) => ids.has(String(s?.segmento_id || "").trim()));
  return filtered.length ? filtered : segmentos;
}

module.exports = { fusionarDiasDesdeClavesPlanas, leerCeldaVisDiaFusionada, leerPresentacionCompuestoDesdeCelda, filasPresentacionCompuestoDesdeCelda, celdaVisIndicaFrancoOperativo, coherirCeldaVisTeoriaFranco, idsSegmentoTeoricoOperativoDesdeCeldaVis, filtrarFilasPresentacionAlTeoricoOperativo, alinearCapaSegmentosAlTeoricoVis, alinearFlagsTipoDiaAlTeoricoOperativo, coherirPresentacionCompuestoAlTeoricoVis, filtrarSegmentosCumplimientoAlTeoricoVis };
