"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { parseFichadasRealesCelda, celdaEsperaFichada } = require("./grillaFichadaPresencia");
const { instanteMarcaInstitucionalMs } = require("./fichadasValidacionMarcas");
const { DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN } = require("./capaTeoricaLimitesCumplimiento");

/**
 * Motor puro: disciplina horaria + débito de tiempo (teoría ↔ fichadas_reales en celda vis_*).
 */




const AUSENCIA_VENTANA_MIN = 120;
const ANALITICA_VERSION = 1;

function msDesdeIso(iso) {
  const ms = new Date(String(iso || "")).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function diffMinutos(desdeMs, hastaMs) {
  if (!Number.isFinite(desdeMs) || !Number.isFinite(hastaMs) || hastaMs <= desdeMs) return 0;
  return Math.round((hastaMs - desdeMs) / 60_000);
}

function normalizarTipoDia(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "guardia") return "guardia";
  if (t === "laborable") return "laborable";
  return t;
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis
 * @param {string} fechaYmd
 */
function extraerTramosFichadaDesdeCelda(celdaVis, fechaYmd) {
  const fecha = String(fechaYmd || "").slice(0, 10);
  const filas = parseFichadasRealesCelda(celdaVis);
  /** @type {{ ingreso_ms: number, egreso_ms: number }[]} */
  const tramos = [];
  /** @type {number[]} */
  const ingresos = [];
  /** @type {number[]} */
  const egresos = [];

  for (const f of filas) {
    if (!f || typeof f !== "object") continue;
    const ingHm = String(f.ingreso || f.hora_ingreso || "").trim();
    const egrHm = String(f.egreso || f.hora_egreso || "").trim();
    const fYmd = String(f.fecha_ymd || f.fecha || fecha).slice(0, 10) || fecha;
    if (ingHm) {
      const ms = instanteMarcaInstitucionalMs(fYmd, ingHm);
      if (ms != null) ingresos.push(ms);
    }
    if (egrHm) {
      const fEgr = String(f.fecha_egreso_ymd || fYmd).slice(0, 10);
      const ms = instanteMarcaInstitucionalMs(fEgr, egrHm);
      if (ms != null) egresos.push(ms);
    }
    if (ingHm && egrHm) {
      const msIn = instanteMarcaInstitucionalMs(fYmd, ingHm);
      const msOut = instanteMarcaInstitucionalMs(String(f.fecha_egreso_ymd || fYmd).slice(0, 10), egrHm);
      if (msIn != null && msOut != null && msOut > msIn) {
        tramos.push({ ingreso_ms: msIn, egreso_ms: msOut });
      }
    }
  }

  ingresos.sort((a, b) => a - b);
  egresos.sort((a, b) => a - b);
  return { tramos, ingresos, egresos, filasCount: filas.length };
}

function derivarAlertas(disciplina, debito, ausencia_automatica) {
  const alertas = [];
  if (disciplina.tardanza_minutos > 0) alertas.push("TARDANZA_PUNITIVA");
  if (disciplina.salida_anticipada_minutos > 0) alertas.push("SALIDA_ANTICIPADA");
  if (disciplina.fuera_de_margen && !alertas.length) alertas.push("FUERA_MARGEN_HORARIO");
  if (debito.incumplimiento_carga_horaria) alertas.push("DEFICIT_HORARIO_GRAVE");
  if (ausencia_automatica) alertas.push("AUSENCIA_AUTOMATICA");
  return alertas;
}

/**
 * @param {Record<string, unknown>|null|undefined} celdaVis — celda `vis_*.dias.DD` (+ tipo_dia / fichadas_esperadas)
 * @param {Record<string, unknown>} capaTeoricaGrupo — slice enriquecido (limites + tipo_dia)
 * @param {{ ahora_evaluacion_ms?: number, fecha_ymd?: string }} [opts]
 */
function calcularDeltasCumplimiento(celdaVis, capaTeoricaGrupo, opts = {}) {
  const capa = capaTeoricaGrupo && typeof capaTeoricaGrupo === "object" ? capaTeoricaGrupo : {};
  const fechaYmd = String(opts.fecha_ymd || capa.fecha_base || "").slice(0, 10);
  const ahoraMs = Number.isFinite(Number(opts.ahora_evaluacion_ms))
    ? Number(opts.ahora_evaluacion_ms)
    : Date.now();

  const ingresoNominalMs = msDesdeIso(capa.ingreso_nominal_iso || capa.ingreso_teorico_final);
  const ingresoLimiteMs = msDesdeIso(capa.ingreso_limite_con_gracia_iso || capa.ingreso_teorico_final);
  const egresoLimiteMs = msDesdeIso(capa.egreso_limite_con_gracia_iso || capa.egreso_teorico_final);
  const egresoNominalMs = msDesdeIso(capa.egreso_nominal_iso || capa.egreso_teorico_final);

  const cargaTeorica = Number(capa.carga_horaria_diaria_minutos);
  const carga_teorica_minutos = Number.isFinite(cargaTeorica) && cargaTeorica > 0
    ? Math.trunc(cargaTeorica)
    : Math.round((Number(capa.horas_teoricas_totales) || 0) * 60);

  const tolDebitoRaw = Number(capa.tolerancia_debitohorario_minutos);
  const tolerancia_debitohorario_minutos = Number.isFinite(tolDebitoRaw) && tolDebitoRaw >= 0
    ? Math.trunc(tolDebitoRaw)
    : DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN;

  const { tramos, ingresos, egresos, filasCount } = extraerTramosFichadaDesdeCelda(celdaVis, fechaYmd);

  let tardanza_minutos = 0;
  let salida_anticipada_minutos = 0;
  let fuera_de_margen = false;

  if (ingresos.length > 0 && ingresoLimiteMs != null && ingresoNominalMs != null) {
    const primeraEntrada = ingresos[0];
    if (primeraEntrada > ingresoLimiteMs) {
      fuera_de_margen = true;
      tardanza_minutos = diffMinutos(ingresoNominalMs, primeraEntrada);
    }
  }

  if (egresos.length > 0 && egresoLimiteMs != null) {
    const ultimaSalida = egresos[egresos.length - 1];
    if (ultimaSalida < egresoLimiteMs) {
      fuera_de_margen = true;
      salida_anticipada_minutos = diffMinutos(ultimaSalida, egresoLimiteMs);
    }
  }

  let carga_real_minutos = 0;
  for (const t of tramos) {
    carga_real_minutos += diffMinutos(t.ingreso_ms, t.egreso_ms);
  }

  const deficit_minutos = Math.max(0, carga_teorica_minutos - carga_real_minutos);
  const incumplimiento_carga_horaria =
    carga_teorica_minutos > 0 && deficit_minutos > tolerancia_debitohorario_minutos;

  const celda = celdaVis && typeof celdaVis === "object" ? celdaVis : {};
  const tipoDia = normalizarTipoDia(celda.tipo_dia ?? capa.tipo_dia);
  const diaLaborable = tipoDia === "laborable" || tipoDia === "guardia" || celdaEsperaFichada(celda);

  let ausencia_automatica = false;
  if (filasCount === 0 && diaLaborable && ingresoLimiteMs != null) {
    const umbralAusencia = ingresoLimiteMs + AUSENCIA_VENTANA_MIN * 60_000;
    if (ahoraMs >= umbralAusencia) {
      ausencia_automatica = true;
    }
  }

  const disciplina = {
    fuera_de_margen,
    tardanza_minutos,
    salida_anticipada_minutos,
    ingreso_nominal_iso: capa.ingreso_nominal_iso ?? null,
    ingreso_limite_con_gracia_iso: capa.ingreso_limite_con_gracia_iso ?? null,
    egreso_nominal_iso: capa.egreso_nominal_iso ?? null,
    egreso_limite_con_gracia_iso: capa.egreso_limite_con_gracia_iso ?? null,
  };

  const debito_tiempo = {
    incumplimiento_carga_horaria,
    carga_teorica_minutos,
    carga_real_minutos,
    deficit_minutos,
    tolerancia_debitohorario_minutos,
  };

  const alertas_activas = derivarAlertas(disciplina, debito_tiempo, ausencia_automatica);

  return {
    version: ANALITICA_VERSION,
    disciplina,
    debito_tiempo,
    ausencia_automatica,
    alertas_activas,
    horas_regulares_efectivas: Math.round((carga_real_minutos / 60) * 100) / 100,
  };
}

module.exports = { extraerTramosFichadaDesdeCelda, calcularDeltasCumplimiento };
