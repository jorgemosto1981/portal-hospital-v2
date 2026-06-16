"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { parseFichadasRealesCelda, celdaEsperaFichada } = require("./grillaFichadaPresencia");
const { instanteMarcaInstitucionalMs } = require("./fichadasValidacionMarcas");
const {
  DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN,
  DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN,
  DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN,
  DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT,
} = require("./capaTeoricaLimitesCumplimiento");

/**
 * Motor puro: disciplina horaria + débito de tiempo (teoría ↔ fichadas_reales en celda vis_*).
 */




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
 * Empareja marcas sueltas (`hora_hm` / `hora`) en tramos ingreso→egreso.
 * @param {Array<{ instante_ms: number, fecha_ymd: string, hora_hm: string }>} sueltas
 * @param {string} fechaDefault
 */
function tramosDesdeMarcasSueltas(sueltas, fechaDefault) {
  const ordenadas = [...sueltas]
    .filter((m) => Number.isFinite(m.instante_ms))
    .sort((a, b) => a.instante_ms - b.instante_ms);
  /** @type {{ ingreso_ms: number, egreso_ms: number }[]} */
  const tramos = [];
  for (let i = 0; i < ordenadas.length; i += 2) {
    const ing = ordenadas[i];
    const egr = ordenadas[i + 1];
    if (!ing) continue;
    if (!egr) break;
    if (egr.instante_ms > ing.instante_ms) {
      tramos.push({ ingreso_ms: ing.instante_ms, egreso_ms: egr.instante_ms });
    }
  }
  return tramos;
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
  /** @type {Array<{ instante_ms: number, fecha_ymd: string, hora_hm: string }>} */
  const marcasSueltas = [];

  for (const f of filas) {
    if (!f || typeof f !== "object") continue;
    const ingHm = String(f.ingreso || f.hora_ingreso || "").trim();
    const egrHm = String(f.egreso || f.hora_egreso || "").trim();
    const horaHm = String(f.hora_hm || f.hora || "").trim();
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
      continue;
    }
    if (horaHm && !ingHm && !egrHm) {
      const ms = instanteMarcaInstitucionalMs(fYmd, horaHm);
      if (ms != null) {
        marcasSueltas.push({ instante_ms: ms, fecha_ymd: fYmd, hora_hm: horaHm });
      }
    }
  }

  if (tramos.length === 0 && marcasSueltas.length >= 2) {
    const tramosSueltas = tramosDesdeMarcasSueltas(marcasSueltas, fecha);
    tramos.push(...tramosSueltas);
    for (const t of tramosSueltas) {
      ingresos.push(t.ingreso_ms);
      egresos.push(t.egreso_ms);
    }
  }

  ingresos.sort((a, b) => a - b);
  egresos.sort((a, b) => a - b);
  return { tramos, ingresos, egresos, filasCount: filas.length };
}

/**
 * Minutos de intersección entre tramos de fichada y ventana teórica nominal.
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {number|null} ventanaInicioMs
 * @param {number|null} ventanaFinMs
 */
function minutosSolapeTramosConVentanaTeorica(tramos, ventanaInicioMs, ventanaFinMs) {
  if (
    !Array.isArray(tramos) ||
    tramos.length === 0 ||
    !Number.isFinite(ventanaInicioMs) ||
    !Number.isFinite(ventanaFinMs) ||
    ventanaFinMs <= ventanaInicioMs
  ) {
    return 0;
  }
  let total = 0;
  for (const t of tramos) {
    const inicio = Math.max(t.ingreso_ms, ventanaInicioMs);
    const fin = Math.min(t.egreso_ms, ventanaFinMs);
    total += diffMinutos(inicio, fin);
  }
  return total;
}

/**
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {number} carga_teorica_minutos
 * @param {number|null} ventanaInicioMs
 * @param {number|null} ventanaFinMs
 * @param {{ umbral_solape_fuera_turno_min?: number, umbral_solape_fuera_turno_pct?: number }} [umbralesSolape]
 */
function evaluarFichadaFueraTurnoTeorico(
  tramos,
  carga_teorica_minutos,
  ventanaInicioMs,
  ventanaFinMs,
  umbralesSolape = {},
) {
  if (!tramos.length || !Number.isFinite(carga_teorica_minutos) || carga_teorica_minutos <= 0) {
    return { fuera_turno: false, solape_minutos: 0, umbral_minutos: 0 };
  }
  const solape = minutosSolapeTramosConVentanaTeorica(tramos, ventanaInicioMs, ventanaFinMs);
  const minBaseRaw = Number(umbralesSolape.umbral_solape_fuera_turno_min);
  const minBase = Number.isFinite(minBaseRaw) && minBaseRaw >= 0
    ? Math.trunc(minBaseRaw)
    : DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN;
  const pctRaw = Number(umbralesSolape.umbral_solape_fuera_turno_pct);
  const pct = Number.isFinite(pctRaw) && pctRaw >= 0
    ? Math.trunc(pctRaw)
    : DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT;
  const umbral = Math.max(minBase, Math.round(carga_teorica_minutos * (pct / 100)));
  return { fuera_turno: solape < umbral, solape_minutos: solape, umbral_minutos: umbral };
}

function derivarAlertas(disciplina, debito, ausencia_automatica, fichadaFueraTurno) {
  const alertas = [];
  if (fichadaFueraTurno) alertas.push("FICHADA_FUERA_TURNO_TEORICO");
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

  const ventanaAusenciaRaw = Number(capa.ventana_ausencia_automatica_min);
  const ventana_ausencia_automatica_min = Number.isFinite(ventanaAusenciaRaw) && ventanaAusenciaRaw >= 0
    ? Math.trunc(ventanaAusenciaRaw)
    : DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN;

  const umbralSolapeMinRaw = Number(capa.umbral_solape_fuera_turno_min);
  const umbral_solape_fuera_turno_min = Number.isFinite(umbralSolapeMinRaw) && umbralSolapeMinRaw >= 0
    ? Math.trunc(umbralSolapeMinRaw)
    : DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN;

  const umbralSolapePctRaw = Number(capa.umbral_solape_fuera_turno_pct);
  const umbral_solape_fuera_turno_pct = Number.isFinite(umbralSolapePctRaw) && umbralSolapePctRaw >= 0
    ? Math.trunc(umbralSolapePctRaw)
    : DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT;

  const { tramos, ingresos, egresos, filasCount } = extraerTramosFichadaDesdeCelda(celdaVis, fechaYmd);

  const celda = celdaVis && typeof celdaVis === "object" ? celdaVis : {};
  const turnoTeoricoId = String(celda.rda_turno_id || capa.turno_id || capa.turno_compuesto_id || "").trim();

  const fueraTurno =
    filasCount > 0 && carga_teorica_minutos > 0
      ? evaluarFichadaFueraTurnoTeorico(
          tramos,
          carga_teorica_minutos,
          ingresoNominalMs,
          egresoNominalMs,
          {
            umbral_solape_fuera_turno_min,
            umbral_solape_fuera_turno_pct,
          },
        )
      : { fuera_turno: false, solape_minutos: 0, umbral_minutos: 0 };

  if (fueraTurno.fuera_turno) {
    let carga_real_bruta = 0;
    for (const t of tramos) carga_real_bruta += diffMinutos(t.ingreso_ms, t.egreso_ms);

    const disciplina = {
      fuera_de_margen: false,
      tardanza_minutos: 0,
      salida_anticipada_minutos: 0,
      ingreso_nominal_iso: capa.ingreso_nominal_iso ?? null,
      ingreso_limite_con_gracia_iso: capa.ingreso_limite_con_gracia_iso ?? null,
      egreso_nominal_iso: capa.egreso_nominal_iso ?? null,
      egreso_limite_con_gracia_iso: capa.egreso_limite_con_gracia_iso ?? null,
    };
    const debito_tiempo = {
      incumplimiento_carga_horaria: false,
      carga_teorica_minutos,
      carga_real_minutos: carga_real_bruta,
      deficit_minutos: 0,
      tolerancia_debitohorario_minutos,
      calculo_suspendido: true,
      motivo_calculo_suspendido: "FICHADA_FUERA_TURNO_TEORICO",
    };

    return {
      version: ANALITICA_VERSION,
      fichada_fuera_turno_teorico: true,
      fichada_fuera_turno_detalle: {
        turno_teorico_id: turnoTeoricoId || null,
        solape_minutos: fueraTurno.solape_minutos,
        umbral_solape_minutos: fueraTurno.umbral_minutos,
      },
      disciplina,
      debito_tiempo,
      ausencia_automatica: false,
      alertas_activas: ["FICHADA_FUERA_TURNO_TEORICO"],
      horas_regulares_efectivas: null,
    };
  }

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

  const tipoDia = normalizarTipoDia(celda.tipo_dia ?? capa.tipo_dia);
  const diaLaborable = tipoDia === "laborable" || tipoDia === "guardia" || celdaEsperaFichada(celda);

  let ausencia_automatica = false;
  if (filasCount === 0 && diaLaborable && ingresoLimiteMs != null) {
    const umbralAusencia = ingresoLimiteMs + ventana_ausencia_automatica_min * 60_000;
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

  const alertas_activas = derivarAlertas(disciplina, debito_tiempo, ausencia_automatica, false);

  return {
    version: ANALITICA_VERSION,
    disciplina,
    debito_tiempo,
    ausencia_automatica,
    alertas_activas,
    horas_regulares_efectivas: Math.round((carga_real_minutos / 60) * 100) / 100,
  };
}

module.exports = { extraerTramosFichadaDesdeCelda, minutosSolapeTramosConVentanaTeorica, evaluarFichadaFueraTurnoTeorico, calcularDeltasCumplimiento };
