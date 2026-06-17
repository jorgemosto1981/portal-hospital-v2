/**
 * Motor puro: disciplina horaria + débito de tiempo (teoría ↔ fichadas_reales en celda vis_*).
 */

import { parseFichadasRealesCelda, celdaEsperaFichada } from "./grillaFichadaPresencia.js";
import { instanteMarcaInstitucionalMs } from "./fichadasValidacionMarcas.js";
import {
  DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN,
  DEFAULT_VENTANA_AUSENCIA_AUTOMATICA_MIN,
  DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_MIN,
  DEFAULT_UMBRAL_SOLAPE_FUERA_TURNO_PCT,
  capaMaterializadaConSegmentosMultiples,
} from "./capaTeoricaLimitesCumplimiento.js";

const ANALITICA_VERSION = 1;

/** Solape mínimo (min) para asignar una fichada a un tramo teórico del día. */
const UMBRAL_EMPAREJAR_SEGMENTO_MIN = 15;
/** Cobertura mínima de la ventana nominal para considerar el segmento presente (RFC filas celda). */
const UMBRAL_COBERTURA_SEGMENTO_RATIO = 0.5;
const DURACION_TRAMO_PUNTUAL_MS = 60_000;
const MARGEN_INGRESO_PUNTUAL_MS = 20 * 60_000;

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
export function extraerTramosFichadaDesdeCelda(celdaVis, fechaYmd) {
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

    if (ingHm && egrHm) {
      const msIn = instanteMarcaInstitucionalMs(fYmd, ingHm);
      const msOut = instanteMarcaInstitucionalMs(String(f.fecha_egreso_ymd || fYmd).slice(0, 10), egrHm);
      if (msIn != null) ingresos.push(msIn);
      if (msOut != null) egresos.push(msOut);
      if (msIn != null && msOut != null && msOut > msIn) {
        tramos.push({ ingreso_ms: msIn, egreso_ms: msOut });
      }
      continue;
    }
    if (ingHm && !egrHm) {
      const msIn = instanteMarcaInstitucionalMs(fYmd, ingHm);
      if (msIn != null) {
        ingresos.push(msIn);
        tramos.push({ ingreso_ms: msIn, egreso_ms: msIn + DURACION_TRAMO_PUNTUAL_MS });
      }
      continue;
    }
    if (!ingHm && egrHm) {
      const fEgr = String(f.fecha_egreso_ymd || fYmd).slice(0, 10);
      const msOut = instanteMarcaInstitucionalMs(fEgr, egrHm);
      if (msOut != null) {
        egresos.push(msOut);
        tramos.push({ ingreso_ms: msOut - DURACION_TRAMO_PUNTUAL_MS, egreso_ms: msOut });
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
 * Ventanas teóricas por segmento (día con huecos / M+N).
 *
 * @param {Record<string, unknown>} capa
 * @param {number} tolIn
 * @param {number} tolOut
 */
function ventanasTeoricasPorSegmento(capa, tolIn, tolOut) {
  if (!capaMaterializadaConSegmentosMultiples(capa)) return [];
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  if (segmentos.length < 2) return [];

  return segmentos
    .map((seg) => {
      if (!seg || typeof seg !== "object") return null;
      const ingreso_nominal_ms = msDesdeIso(seg.ingreso_iso);
      const egreso_nominal_ms = msDesdeIso(seg.egreso_iso);
      if (ingreso_nominal_ms == null || egreso_nominal_ms == null) return null;
      const ingreso_limite_ms = ingreso_nominal_ms + Math.max(0, tolIn) * 60_000;
      const egreso_limite_ms = egreso_nominal_ms - Math.max(0, tolOut) * 60_000;
      return {
        segmento_id: String(seg.segmento_id || "").trim() || null,
        ingreso_nominal_ms,
        egreso_nominal_ms,
        ingreso_limite_ms,
        egreso_limite_ms,
        carga_minutos: diffMinutos(ingreso_nominal_ms, egreso_nominal_ms),
      };
    })
    .filter(Boolean);
}

/**
 * @param {{ ingreso_ms: number, egreso_ms: number }} tramo
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number }} ventana
 */
function solapeTramoConVentanaParaEmparejar(tramo, ventana) {
  const solape = minutosSolapeTramosConVentanaTeorica(
    [tramo],
    ventana.ingreso_nominal_ms,
    ventana.egreso_nominal_ms,
  );
  if (solape >= UMBRAL_EMPAREJAR_SEGMENTO_MIN) return solape;
  const durMs = tramo.egreso_ms - tramo.ingreso_ms;
  if (durMs > 2 * 60_000 && solape > 0) return UMBRAL_EMPAREJAR_SEGMENTO_MIN;
  if (durMs > 2 * 60_000) return solape;
  const ingresoEnVentana =
    tramo.ingreso_ms >= ventana.ingreso_nominal_ms - MARGEN_INGRESO_PUNTUAL_MS
    && tramo.ingreso_ms <= ventana.ingreso_nominal_ms + MARGEN_INGRESO_PUNTUAL_MS;
  if (ingresoEnVentana) return UMBRAL_EMPAREJAR_SEGMENTO_MIN;
  return solape;
}

/**
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {Array<{ ingreso_nominal_ms: number, egreso_nominal_ms: number }>} ventanas
 */
function emparejarTramosConVentanasSegmento(tramos, ventanas) {
  /** @type {{ vIdx: number, tIdx: number, solape: number }[]} */
  const candidatos = [];
  for (let vIdx = 0; vIdx < ventanas.length; vIdx += 1) {
    for (let tIdx = 0; tIdx < tramos.length; tIdx += 1) {
      const solape = solapeTramoConVentanaParaEmparejar(tramos[tIdx], ventanas[vIdx]);
      if (solape >= UMBRAL_EMPAREJAR_SEGMENTO_MIN) {
        candidatos.push({ vIdx, tIdx, solape });
      }
    }
  }
  candidatos.sort((a, b) => b.solape - a.solape);
  const ventanaAsignada = new Map();
  const tramoUsado = new Set();
  for (const c of candidatos) {
    if (ventanaAsignada.has(c.vIdx) || tramoUsado.has(c.tIdx)) continue;
    ventanaAsignada.set(c.vIdx, c.tIdx);
    tramoUsado.add(c.tIdx);
  }
  return ventanas.map((ventana, vIdx) => {
    const tIdx = ventanaAsignada.get(vIdx);
    if (tIdx != null) return { ventana, tramo: tramos[tIdx] };
    return { ventana, tramo: null };
  });
}

/**
 * @param {{ ingreso_ms: number, egreso_ms: number }|null} tramo
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number, ingreso_limite_ms: number, egreso_limite_ms: number }} ventana
 */
function tramoCuentaComoCubiertoEnSegmento(tramo, ventana) {
  if (!tramo) return false;
  const solapeNominal = minutosSolapeTramosConVentanaTeorica(
    [tramo],
    ventana.ingreso_nominal_ms,
    ventana.egreso_nominal_ms,
  );
  const ingresoEnVentana =
    tramo.ingreso_ms >= ventana.ingreso_nominal_ms - MARGEN_INGRESO_PUNTUAL_MS
    && tramo.ingreso_ms <= ventana.ingreso_nominal_ms + MARGEN_INGRESO_PUNTUAL_MS;
  if (ingresoEnVentana) return true;
  return solapeNominal >= UMBRAL_EMPAREJAR_SEGMENTO_MIN;
}

/**
 * Recorte de presencia real dentro de la ventana nominal del segmento (unión de tramos).
 *
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number }} ventana
 */
function recortePresenciaEnVentanaNominal(tramos, ventana) {
  let ingreso_ms = null;
  let egreso_ms = null;
  for (const t of tramos) {
    const inicio = Math.max(t.ingreso_ms, ventana.ingreso_nominal_ms);
    const fin = Math.min(t.egreso_ms, ventana.egreso_nominal_ms);
    if (fin <= inicio) continue;
    if (ingreso_ms == null || inicio < ingreso_ms) ingreso_ms = inicio;
    if (egreso_ms == null || fin > egreso_ms) egreso_ms = fin;
  }
  if (ingreso_ms == null || egreso_ms == null) return null;
  return { ingreso_ms, egreso_ms };
}

/**
 * Marca puntual al ingreso nominal del segmento (ingreso sin egreso / tramo ≤2 min).
 *
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number }} ventana
 */
function hayMarcaPuntualAlIngresoSegmento(tramos, ventana) {
  for (const t of tramos) {
    const durMs = t.egreso_ms - t.ingreso_ms;
    const ingresoEnVentana =
      t.ingreso_ms >= ventana.ingreso_nominal_ms - MARGEN_INGRESO_PUNTUAL_MS
      && t.ingreso_ms <= ventana.ingreso_nominal_ms + MARGEN_INGRESO_PUNTUAL_MS;
    if (!ingresoEnVentana) continue;
    if (durMs <= 2 * 60_000) return true;
    const solape = minutosSolapeTramosConVentanaTeorica(
      [t],
      ventana.ingreso_nominal_ms,
      ventana.egreso_nominal_ms,
    );
    if (solape > 0) return true;
  }
  return false;
}

/**
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number, ingreso_limite_ms: number, egreso_limite_ms: number, carga_minutos: number, segmento_id: string|null }} ventana
 */
function segmentoCubiertoPorCobertura(tramos, ventana) {
  const carga = Math.trunc(Number(ventana.carga_minutos) || 0);
  if (carga <= 0) return false;
  const minutosCubiertos = minutosSolapeTramosConVentanaTeorica(
    tramos,
    ventana.ingreso_nominal_ms,
    ventana.egreso_nominal_ms,
  );
  const ratio = minutosCubiertos / carga;
  if (ratio >= UMBRAL_COBERTURA_SEGMENTO_RATIO) return true;
  return hayMarcaPuntualAlIngresoSegmento(tramos, ventana);
}

/**
 * Disciplina en un segmento usando presencia recortada a la ventana nominal.
 *
 * @param {{ ingreso_ms: number, egreso_ms: number }} recorte
 * @param {{ ingreso_nominal_ms: number, egreso_nominal_ms: number, ingreso_limite_ms: number, egreso_limite_ms: number }} ventana
 */
function disciplinaDesdeRecorteEnVentana(recorte, ventana) {
  let segTard = 0;
  let segSal = 0;
  let segIngAnt = 0;
  if (recorte.ingreso_ms > ventana.ingreso_limite_ms) {
    segTard = diffMinutos(ventana.ingreso_nominal_ms, recorte.ingreso_ms);
  } else if (recorte.ingreso_ms < ventana.ingreso_nominal_ms) {
    segIngAnt = diffMinutos(recorte.ingreso_ms, ventana.ingreso_nominal_ms);
  }
  if (recorte.egreso_ms < ventana.egreso_limite_ms) {
    segSal = diffMinutos(recorte.egreso_ms, ventana.egreso_nominal_ms);
  }
  return { segTard, segSal, segIngAnt };
}

/**
 * Disciplina horaria y resumen por tramo (≥2 segmentos): cobertura por intersección + umbral 50%.
 *
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {ReturnType<typeof ventanasTeoricasPorSegmento>} ventanas
 */
function calcularDisciplinaPorSegmentos(tramos, ventanas) {
  let tardanza_minutos = 0;
  let salida_anticipada_minutos = 0;
  let ingreso_anticipado_minutos = 0;
  /** @type {Array<Record<string, unknown>>} */
  const segmentos_cumplimiento = [];

  for (const ventana of ventanas) {
    const minutosCubiertos = minutosSolapeTramosConVentanaTeorica(
      tramos,
      ventana.ingreso_nominal_ms,
      ventana.egreso_nominal_ms,
    );
    const cubierto = segmentoCubiertoPorCobertura(tramos, ventana);
    let segTard = 0;
    let segSal = 0;
    let segIngAnt = 0;
    if (cubierto) {
      const recorte = recortePresenciaEnVentanaNominal(tramos, ventana);
      if (recorte) {
        const d = disciplinaDesdeRecorteEnVentana(recorte, ventana);
        segTard = d.segTard;
        segSal = d.segSal;
        segIngAnt = d.segIngAnt;
        tardanza_minutos += segTard;
        salida_anticipada_minutos += segSal;
        ingreso_anticipado_minutos += segIngAnt;
      }
    }
    segmentos_cumplimiento.push({
      segmento_id: ventana.segmento_id,
      cubierto,
      carga_teorica_minutos: ventana.carga_minutos,
      cobertura_minutos: minutosCubiertos,
      tardanza_minutos: segTard,
      salida_anticipada_minutos: segSal,
      ingreso_anticipado_minutos: segIngAnt,
    });
  }

  return {
    tardanza_minutos,
    salida_anticipada_minutos,
    ingreso_anticipado_minutos,
    segmentos_cumplimiento,
    calculo_por_segmentos: true,
  };
}

/**
 * Minutos de incumplimiento por tramo para badge de celda (no sumar M+N en un solo chip).
 *
 * @param {Array<Record<string, unknown>>} segmentos
 * @param {number} tolerancia_debitohorario_minutos
 */
export function enriquecerIncumplimientoCeldaPorSegmento(segmentos, tolerancia_debitohorario_minutos) {
  if (!Array.isArray(segmentos)) return [];
  return segmentos.map((seg) => {
    const cubierto = seg.cubierto === true;
    const carga = Math.trunc(Number(seg.carga_teorica_minutos) || 0);
    const tard = Math.trunc(Number(seg.tardanza_minutos) || 0);
    const sal = Math.trunc(Number(seg.salida_anticipada_minutos) || 0);
    const punt = disciplinaHorariaEsIncumplimiento(tard, sal, tolerancia_debitohorario_minutos);
    let incumplimiento_celda_minutos = 0;
    /** @type {string|null} */
    let incumplimiento_celda_tipo = null;
    if (!cubierto && carga > 0) {
      incumplimiento_celda_minutos = carga;
      incumplimiento_celda_tipo = "ausente_tramo";
    } else if (punt.salida_anticipada_punitiva_min > 0) {
      incumplimiento_celda_minutos = punt.salida_anticipada_punitiva_min;
      incumplimiento_celda_tipo = "salida";
    } else if (punt.tardanza_punitiva_min > 0) {
      incumplimiento_celda_minutos = punt.tardanza_punitiva_min;
      incumplimiento_celda_tipo = "tardanza";
    } else if (cubierto && sal > 0) {
      // Badge por tramo (M+N): mostrar desvío aunque no supere tol. global de alertas
      incumplimiento_celda_minutos = sal;
      incumplimiento_celda_tipo = "salida";
    } else if (cubierto && tard > 0) {
      incumplimiento_celda_minutos = tard;
      incumplimiento_celda_tipo = "tardanza";
    }
    return { ...seg, incumplimiento_celda_minutos, incumplimiento_celda_tipo };
  });
}

/**
 * Minutos de intersección entre tramos de fichada y ventana teórica nominal.
 * @param {Array<{ ingreso_ms: number, egreso_ms: number }>} tramos
 * @param {number|null} ventanaInicioMs
 * @param {number|null} ventanaFinMs
 */
export function minutosSolapeTramosConVentanaTeorica(tramos, ventanaInicioMs, ventanaFinMs) {
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
export function evaluarFichadaFueraTurnoTeorico(
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

/**
 * Tardanza / salida anticipada solo son falta si superan la tolerancia de débito del régimen.
 * El ingreso anticipado no es incumplimiento.
 *
 * @param {number} tardanza_minutos
 * @param {number} salida_anticipada_minutos
 * @param {number} tolerancia_debitohorario_minutos
 */
export function disciplinaHorariaEsIncumplimiento(
  tardanza_minutos,
  salida_anticipada_minutos,
  tolerancia_debitohorario_minutos,
) {
  const tol = Number.isFinite(Number(tolerancia_debitohorario_minutos))
    && Number(tolerancia_debitohorario_minutos) >= 0
    ? Math.trunc(Number(tolerancia_debitohorario_minutos))
    : DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN;
  const tard = Math.max(0, Math.trunc(Number(tardanza_minutos) || 0));
  const sal = Math.max(0, Math.trunc(Number(salida_anticipada_minutos) || 0));
  return {
    tardanza_punitiva_min: tard > tol ? tard : 0,
    salida_anticipada_punitiva_min: sal > tol ? sal : 0,
    hay_incumplimiento: tard > tol || sal > tol,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} analitica
 */
export function disciplinaHorariaIncumplimientoDesdeAnalitica(analitica) {
  const d = analitica?.disciplina && typeof analitica.disciplina === "object" ? analitica.disciplina : {};
  const deb = analitica?.debito_tiempo && typeof analitica.debito_tiempo === "object"
    ? analitica.debito_tiempo
    : {};
  const tolRaw = Number(deb.tolerancia_debitohorario_minutos);
  const tol = Number.isFinite(tolRaw) && tolRaw >= 0
    ? Math.trunc(tolRaw)
    : DEFAULT_TOLERANCIA_DEBITOHORARIO_MIN;
  return disciplinaHorariaEsIncumplimiento(
    d.tardanza_minutos,
    d.salida_anticipada_minutos,
    tol,
  );
}

function derivarAlertas(disciplina, debito, ausencia_automatica, fichadaFueraTurno) {
  const alertas = [];
  if (fichadaFueraTurno) alertas.push("FICHADA_FUERA_TURNO_TEORICO");
  const tol = Number(debito.tolerancia_debitohorario_minutos);
  const { tardanza_punitiva_min, salida_anticipada_punitiva_min } = disciplinaHorariaEsIncumplimiento(
    disciplina.tardanza_minutos,
    disciplina.salida_anticipada_minutos,
    tol,
  );
  if (tardanza_punitiva_min > 0) alertas.push("TARDANZA_PUNITIVA");
  if (salida_anticipada_punitiva_min > 0) alertas.push("SALIDA_ANTICIPADA");
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
export function calcularDeltasCumplimiento(celdaVis, capaTeoricaGrupo, opts = {}) {
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

  const tolIn = Number(capa.tolerancia_ingreso_dia_min) || 0;
  const tolOut = Number(capa.tolerancia_egreso_dia_min) || 0;
  const ventanasSegmento = ventanasTeoricasPorSegmento(capa, tolIn, tolOut);

  const umbralesSolape = {
    umbral_solape_fuera_turno_min,
    umbral_solape_fuera_turno_pct,
  };

  let fueraTurno = { fuera_turno: false, solape_minutos: 0, umbral_minutos: 0 };
  if (filasCount > 0 && carga_teorica_minutos > 0 && ventanasSegmento.length < 2) {
    fueraTurno = evaluarFichadaFueraTurnoTeorico(
      tramos,
      carga_teorica_minutos,
      ingresoNominalMs,
      egresoNominalMs,
      umbralesSolape,
    );
  }

  if (fueraTurno.fuera_turno) {
    let carga_real_bruta = 0;
    for (const t of tramos) carga_real_bruta += diffMinutos(t.ingreso_ms, t.egreso_ms);

    const disciplina = {
      fuera_de_margen: false,
      tardanza_minutos: 0,
      salida_anticipada_minutos: 0,
      ingreso_anticipado_minutos: 0,
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
  let ingreso_anticipado_minutos = 0;
  let fuera_de_margen = false;
  let calculo_por_segmentos = false;
  /** @type {Array<Record<string, unknown>>|undefined} */
  let segmentos_cumplimiento;

  if (ventanasSegmento.length >= 2) {
    const porSeg = calcularDisciplinaPorSegmentos(tramos, ventanasSegmento);
    tardanza_minutos = porSeg.tardanza_minutos;
    salida_anticipada_minutos = porSeg.salida_anticipada_minutos;
    ingreso_anticipado_minutos = porSeg.ingreso_anticipado_minutos;
    segmentos_cumplimiento = enriquecerIncumplimientoCeldaPorSegmento(
      porSeg.segmentos_cumplimiento,
      tolerancia_debitohorario_minutos,
    );
    calculo_por_segmentos = true;
  } else if (ingresos.length > 0 && ingresoNominalMs != null && ingresoLimiteMs != null) {
    const primeraEntrada = ingresos[0];
    if (primeraEntrada > ingresoLimiteMs) {
      tardanza_minutos = diffMinutos(ingresoNominalMs, primeraEntrada);
    } else if (primeraEntrada < ingresoNominalMs) {
      ingreso_anticipado_minutos = diffMinutos(primeraEntrada, ingresoNominalMs);
    }
  }

  if (!calculo_por_segmentos && egresos.length > 0 && egresoLimiteMs != null && egresoNominalMs != null) {
    const ultimaSalida = egresos[egresos.length - 1];
    if (ultimaSalida < egresoLimiteMs) {
      salida_anticipada_minutos = diffMinutos(ultimaSalida, egresoNominalMs);
    }
  }

  fuera_de_margen = disciplinaHorariaEsIncumplimiento(
    tardanza_minutos,
    salida_anticipada_minutos,
    tolerancia_debitohorario_minutos,
  ).hay_incumplimiento;

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
    ingreso_anticipado_minutos,
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
    ...(calculo_por_segmentos ? { calculo_por_segmentos: true, segmentos_cumplimiento } : {}),
    disciplina,
    debito_tiempo,
    ausencia_automatica,
    alertas_activas,
    horas_regulares_efectivas: Math.round((carga_real_minutos / 60) * 100) / 100,
  };
}
