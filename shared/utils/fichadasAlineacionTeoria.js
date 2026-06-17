/**
 * Alineación marcas crudas → fichadas_reales según capa teórica (Fase B).
 * Sin I/O Firestore.
 */

import { instanteMarcaInstitucionalMs } from "./fichadasValidacionMarcas.js";

export const CODIGO_NOCTURNIDAD_AMBIGUA = "NOCTURNIDAD_AMBIGUA";

const UMBRAL_EQUIDISTANCIA_MS = 60 * 1000;
/** Separación en reloj (mismo día) por debajo de esto → ingreso/egreso en orden cronológico, no noche. */
const UMBRAL_PAR_MISMO_DIA_MIN = 12 * 60;

/**
 * @param {string|null|undefined} hm
 */
function parseHmMinutos(hm) {
  const m = String(hm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * @param {string} fechaYmd
 */
function diaSiguienteYmd(fechaYmd) {
  const [y, mo, d] = String(fechaYmd).split("-").map(Number);
  const t = Date.UTC(y, mo - 1, d + 1, 12, 0, 0);
  const nd = new Date(t);
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}-${String(nd.getUTCDate()).padStart(2, "0")}`;
}

/**
 * @param {Record<string, unknown>|null|undefined} celda
 */
export function celdaTeoriaCruzaMedianoche(celda) {
  if (!celda || typeof celda !== "object") return false;
  const ing = parseHmMinutos(celda.rda_ingreso);
  const egr = parseHmMinutos(celda.rda_egreso);
  if (ing == null || egr == null) return false;
  return egr <= ing;
}

/**
 * @param {string} fechaYmd
 * @param {string} horaHm
 */
function instanteEnDia(fechaYmd, horaHm) {
  const ms = instanteMarcaInstitucionalMs(fechaYmd, horaHm);
  return ms == null ? null : ms;
}

/**
 * Anclas teóricas de ingreso/egreso en línea de tiempo absoluta.
 *
 * @param {Record<string, unknown>|null|undefined} celda
 * @param {string} fechaYmd — día calendario de la celda vis
 * @returns {Array<{ rol: 'ingreso'|'egreso', instante_ms: number, hora_hm: string }>}
 */
export function construirAnclasTeoricasCelda(celda, fechaYmd) {
  if (!celda || typeof celda !== "object" || !fechaYmd) return [];

  const segmentos = Array.isArray(celda.segmentos) ? celda.segmentos : [];
  if (segmentos.length >= 2) {
    const anclas = [];
    for (const seg of segmentos) {
      if (!seg || typeof seg !== "object") continue;
      const ing = String(seg.ingreso || "").trim();
      const egr = String(seg.egreso || "").trim();
      if (ing) {
        const ms = instanteEnDia(fechaYmd, ing);
        if (ms != null) anclas.push({ rol: "ingreso", instante_ms: ms, hora_hm: ing });
      }
      if (egr) {
        let fEgr = fechaYmd;
        const ingMin = parseHmMinutos(ing);
        const egrMin = parseHmMinutos(egr);
        if (ingMin != null && egrMin != null && egrMin <= ingMin) {
          fEgr = diaSiguienteYmd(fechaYmd);
        }
        const ms = instanteEnDia(fEgr, egr);
        if (ms != null) anclas.push({ rol: "egreso", instante_ms: ms, hora_hm: egr });
      }
    }
    return anclas;
  }

  const ing = String(celda.rda_ingreso || "").trim();
  const egr = String(celda.rda_egreso || "").trim();
  const anclas = [];
  if (ing) {
    const ms = instanteEnDia(fechaYmd, ing);
    if (ms != null) anclas.push({ rol: "ingreso", instante_ms: ms, hora_hm: ing });
  }
  if (egr) {
    const fEgr = celdaTeoriaCruzaMedianoche(celda) ? diaSiguienteYmd(fechaYmd) : fechaYmd;
    const ms = instanteEnDia(fEgr, egr);
    if (ms != null) anclas.push({ rol: "egreso", instante_ms: ms, hora_hm: egr });
  }
  return anclas;
}

/**
 * @param {object} marca
 * @param {string} marca.fecha_ymd
 * @param {string} marca.hora_hm
 * @param {number} [marca.instante_ms]
 */
export function normalizarMarcaCruda(marca) {
  const fecha_ymd = String(marca.fecha_ymd || "").trim();
  const hora_hm = String(marca.hora_hm || "").trim();
  let instante_ms = Number(marca.instante_ms);
  if (!Number.isFinite(instante_ms)) {
    instante_ms = instanteMarcaInstitucionalMs(fecha_ymd, hora_hm);
  }
  return { ...marca, fecha_ymd, hora_hm, instante_ms };
}

/**
 * Rebucket nocturnidad: marca en D+1 puede imputarse al día D.
 *
 * @param {object} marca
 * @param {object} ctx
 * @param {Record<string, unknown>|null} [ctx.celda_d]
 * @param {Record<string, unknown>|null} [ctx.celda_d_plus]
 * @param {string} ctx.fecha_ymd_d — día D (calendario de la celda destino)
 */
export function resolverImputacionNocturnaMarca(marca, ctx) {
  const m = normalizarMarcaCruda(marca);
  const advertencias = [];
  const celdaD = ctx.celda_d;
  const celdaDplus = ctx.celda_d_plus;
  const fechaD = ctx.fecha_ymd_d;
  const fechaDplus = diaSiguienteYmd(fechaD);

  if (!celdaD || m.fecha_ymd !== fechaDplus) {
    return { marca: m, fecha_imputacion_ymd: m.fecha_ymd, advertencias };
  }

  if (!celdaTeoriaCruzaMedianoche(celdaD)) {
    return { marca: m, fecha_imputacion_ymd: m.fecha_ymd, advertencias };
  }

  const anclasD = construirAnclasTeoricasCelda(celdaD, fechaD);
  const anclasDplus = celdaDplus ? construirAnclasTeoricasCelda(celdaDplus, fechaDplus) : [];
  const egresoD = anclasD.find((a) => a.rol === "egreso");
  const ingresoDplus = anclasDplus.find((a) => a.rol === "ingreso");

  if (!egresoD || !Number.isFinite(m.instante_ms)) {
    return { marca: m, fecha_imputacion_ymd: m.fecha_ymd, advertencias };
  }

  const distEgresoD = Math.abs(m.instante_ms - egresoD.instante_ms);
  let distIngresoDplus = Infinity;
  if (ingresoDplus) {
    distIngresoDplus = Math.abs(m.instante_ms - ingresoDplus.instante_ms);
  }

  if (distEgresoD < distIngresoDplus) {
    return { marca: m, fecha_imputacion_ymd: fechaD, advertencias };
  }

  if (ingresoDplus && Math.abs(distEgresoD - distIngresoDplus) <= UMBRAL_EQUIDISTANCIA_MS) {
    advertencias.push(CODIGO_NOCTURNIDAD_AMBIGUA);
    if (distEgresoD <= distIngresoDplus) {
      return { marca: m, fecha_imputacion_ymd: fechaD, advertencias };
    }
  }

  return { marca: m, fecha_imputacion_ymd: m.fecha_ymd, advertencias };
}

/**
 * Asigna rol ingreso/egreso por proximidad greedy a anclas.
 *
 * @param {Array<object>} marcas
 * @param {Array<{ rol: string, instante_ms: number }>} anclas
 */
function asignarRolesPorProximidad(marcas, anclas) {
  const sorted = [...marcas].sort((a, b) => Number(a.instante_ms) - Number(b.instante_ms));
  const anclasIng = anclas.filter((a) => a.rol === "ingreso");
  const anclasEgr = anclas.filter((a) => a.rol === "egreso");
  const usadosIng = new Set();
  const usadosEgr = new Set();

  return sorted.map((marca) => {
    const ms = Number(marca.instante_ms);
    let mejor = null;
    let mejorDist = Infinity;
    let empate = false;

    const candidatos = [
      ...anclasIng.map((a, i) => ({ ...a, idx: i, pool: "ingreso" })),
      ...anclasEgr.map((a, i) => ({ ...a, idx: i, pool: "egreso" })),
    ];

    for (const a of candidatos) {
      const used = a.pool === "ingreso" ? usadosIng : usadosEgr;
      if (used.has(a.idx)) continue;
      const d = Math.abs(ms - a.instante_ms);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = a;
        empate = false;
      } else if (d === mejorDist && mejor && d < Infinity) {
        empate = true;
      }
    }

    const advertencias = [];
    if (empate) advertencias.push(CODIGO_NOCTURNIDAD_AMBIGUA);

    let rol = "ingreso";
    if (mejor) {
      rol = /** @type {'ingreso'|'egreso'} */ (mejor.pool);
      if (mejor.pool === "ingreso") usadosIng.add(mejor.idx);
      else usadosEgr.add(mejor.idx);
    } else if (anclasEgr.length > anclasIng.length) {
      rol = "egreso";
    }

    return { ...marca, rol_asignado: rol, advertencias };
  });
}

/**
 * ABM grilla: marcas con rol explícito (ingreso / egreso).
 *
 * @param {Array<object>} marcas
 */
function asignarRolesDesdeMarcasConRolExplicito(marcas) {
  if (marcas.length !== 2) return null;
  const ing = marcas.find((m) => m.rol_asignado === "ingreso");
  const egr = marcas.find((m) => m.rol_asignado === "egreso");
  if (!ing || !egr) return null;
  return [
    { ...ing, rol_asignado: "ingreso", advertencias: [] },
    { ...egr, rol_asignado: "egreso", advertencias: [] },
  ];
}

/**
 * Dos marcas en el mismo día calendario D con turno que cruza medianoche.
 * Tramo corto en el mismo día (ej. 05:35–06:38) → ingreso/egreso cronológico.
 * Tramo largo (ej. 05:05 y 21:00) → tarde ingreso, madrugada egreso (D+1).
 *
 * @param {Array<object>} marcas
 * @param {string} fecha_ymd
 */
function asignarRolesDosMarcasTurnoNoche(marcas, fecha_ymd) {
  const sorted = [...marcas]
    .filter((m) => Number.isFinite(Number(m.instante_ms)))
    .sort((a, b) => Number(a.instante_ms) - Number(b.instante_ms));
  if (sorted.length !== 2) return null;
  const dia = String(fecha_ymd || "").trim();
  if (!dia || sorted.some((m) => String(m.fecha_ymd || "").trim() !== dia)) return null;
  const [early, late] = sorted;
  const earlyMin = parseHmMinutos(early.hora_hm);
  const lateMin = parseHmMinutos(late.hora_hm);
  if (earlyMin == null || lateMin == null) return null;
  const gapMin = lateMin - earlyMin;
  if (gapMin <= UMBRAL_PAR_MISMO_DIA_MIN) {
    return [
      { ...early, rol_asignado: "ingreso", advertencias: [] },
      { ...late, rol_asignado: "egreso", advertencias: [] },
    ];
  }
  return [
    { ...late, rol_asignado: "ingreso", advertencias: [] },
    { ...early, rol_asignado: "egreso", advertencias: [] },
  ];
}

/**
 * @param {Array<{ rol_asignado: string, hora_hm: string, advertencias?: string[] }>} asignadas
 * @param {string} fecha_ymd
 * @param {Record<string, unknown>|null|undefined} celda
 */
function armarFichadasRealesDesdeRoles(asignadas, fecha_ymd, celda) {
  const ingresos = asignadas.filter((a) => a.rol_asignado === "ingreso").map((a) => a.hora_hm);
  const egresos = asignadas.filter((a) => a.rol_asignado === "egreso").map((a) => a.hora_hm);
  const pares = [];
  const n = Math.max(ingresos.length, egresos.length);
  const cruza = celdaTeoriaCruzaMedianoche(celda);
  for (let i = 0; i < n; i += 1) {
    const ingreso = ingresos[i] || null;
    const egreso = egresos[i] || null;
    if (ingreso && egreso) {
      /** @type {Record<string, string>} */
      const fila = { ingreso, egreso, fecha_ymd };
      const ingMin = parseHmMinutos(ingreso);
      const egrMin = parseHmMinutos(egreso);
      if (cruza && ingMin != null && egrMin != null && egrMin <= ingMin) {
        fila.fecha_egreso_ymd = diaSiguienteYmd(fecha_ymd);
      }
      pares.push(fila);
    } else if (ingreso) pares.push({ ingreso, egreso: null, fecha_ymd });
    else if (egreso) pares.push({ ingreso: null, egreso, fecha_ymd });
  }
  return pares.filter((p) => p.ingreso || p.egreso);
}

/**
 * Una fila de `fichadas_reales` desde par ingreso/egreso del ABM grilla.
 *
 * @param {string} ingresoHm
 * @param {string} egresoHm
 * @param {string} fecha_ymd
 * @param {Record<string, unknown>|null|undefined} [_celda]
 */
export function fichadaRealFilaDesdeParAbm(ingresoHm, egresoHm, fecha_ymd, _celda) {
  const ingreso = String(ingresoHm || "").trim();
  const egreso = String(egresoHm || "").trim();
  if (!ingreso || !egreso || !fecha_ymd) return null;
  /** @type {Record<string, string>} */
  const fila = { ingreso, egreso, fecha_ymd };
  const ingMin = parseHmMinutos(ingreso);
  const egrMin = parseHmMinutos(egreso);
  if (ingMin != null && egrMin != null && egrMin <= ingMin) {
    fila.fecha_egreso_ymd = diaSiguienteYmd(fecha_ymd);
  }
  return fila;
}

/**
 * ABM «Confirmar alta»: agrega un tramo sin re-emparejar todas las marcas del día.
 *
 * @param {Array<Record<string, unknown>>|null|undefined} fichadas_existentes
 * @param {Array<{ hora_hm?: string; rol?: string }>|null|undefined} marcasPayload
 * @param {string} fecha_ymd
 * @param {Record<string, unknown>|null|undefined} celda
 * @returns {Array<Record<string, unknown>>|null}
 */
export function agregarTramoAbmAFichadasExistentes(fichadas_existentes, marcasPayload, fecha_ymd, celda) {
  if (!Array.isArray(marcasPayload) || marcasPayload.length < 2) return null;
  const ingM = marcasPayload.find((m) => String(m?.rol || "").trim().toLowerCase() === "ingreso");
  const egrM = marcasPayload.find((m) => String(m?.rol || "").trim().toLowerCase() === "egreso");
  if (!ingM?.hora_hm || !egrM?.hora_hm) return null;
  const fila = fichadaRealFilaDesdeParAbm(String(ingM.hora_hm), String(egrM.hora_hm), fecha_ymd, celda);
  if (!fila) return null;
  const actuales = Array.isArray(fichadas_existentes) ? [...fichadas_existentes] : [];
  actuales.push(fila);
  return actuales;
}

/**
 * Pipeline principal para un día calendario D.
 *
 * @param {object} params
 * @param {Array<object>} params.marcas — instantes normalizados (Fase A)
 * @param {Record<string, unknown>|null|undefined} params.celda_teoria
 * @param {Record<string, unknown>|null|undefined} [params.celda_teoria_dia_siguiente]
 * @param {string} params.fecha_ymd — día D de la celda vis
 */
export function alinearMarcasConTeoriaDia(params) {
  const fecha_ymd = String(params.fecha_ymd || "").trim();
  const celda = params.celda_teoria;
  const celdaPlus = params.celda_teoria_dia_siguiente ?? null;
  const rawMarcas = Array.isArray(params.marcas) ? params.marcas : [];

  const advertenciasGlobales = new Set();

  const imputadas = rawMarcas.map((marca) => {
    const r = resolverImputacionNocturnaMarca(marca, {
      celda_d: celda,
      celda_d_plus: celdaPlus,
      fecha_ymd_d: fecha_ymd,
    });
    for (const adv of r.advertencias) advertenciasGlobales.add(adv);
    return { ...r.marca, fecha_imputacion_ymd: r.fecha_imputacion_ymd };
  });

  const delDia = imputadas.filter((m) => m.fecha_imputacion_ymd === fecha_ymd);
  const anclas = construirAnclasTeoricasCelda(celda, fecha_ymd);

  if (!anclas.length && delDia.length) {
    return {
      ok: true,
      fichadas_reales: delDia.map((m) => ({ hora_hm: m.hora_hm })),
      marcas_detalle: delDia,
      advertencias_fichada_abiertas: [...advertenciasGlobales],
    };
  }

  const asignadasExplicitas = asignarRolesDesdeMarcasConRolExplicito(delDia);
  const asignadasNoche =
    !asignadasExplicitas && celdaTeoriaCruzaMedianoche(celda)
      ? asignarRolesDosMarcasTurnoNoche(delDia, fecha_ymd)
      : null;
  const asignadas = asignadasExplicitas || asignadasNoche || asignarRolesPorProximidad(delDia, anclas);
  for (const a of asignadas) {
    for (const adv of a.advertencias || []) advertenciasGlobales.add(adv);
  }

  const fichadas_reales = armarFichadasRealesDesdeRoles(asignadas, fecha_ymd, celda);

  return {
    ok: true,
    fichadas_reales,
    marcas_detalle: asignadas,
    advertencias_fichada_abiertas: [...advertenciasGlobales],
  };
}

/**
 * @param {string} fechaYmd
 * @param {string[]} fechasOrdenadas
 */
function diaAnteriorEnSet(fechaCal, fechasOrdenadas) {
  return fechasOrdenadas.find((f) => diaSiguienteYmd(f) === fechaCal) || null;
}

/**
 * Varias marcas de un lote con contexto de celdas por fecha (reconciliación / import).
 *
 * @param {object} params
 * @param {Array<object>} params.marcas
 * @param {Record<string, Record<string, unknown>>} params.celdas_por_fecha — key fecha_ymd
 */
export function alinearMarcasConTeoriaEnCalendario(params) {
  const marcas = Array.isArray(params.marcas) ? params.marcas.map(normalizarMarcaCruda) : [];
  const celdas = params.celdas_por_fecha || {};
  const fechasCalendario = [...new Set(marcas.map((m) => m.fecha_ymd))].sort();

  const porImputacion = new Map();
  const advertenciasRebucketPorDia = new Map();

  for (const marca of marcas) {
    const fechaCal = marca.fecha_ymd;
    const fechaPrev = diaAnteriorEnSet(fechaCal, fechasCalendario);
    let r;
    if (fechaPrev && celdas[fechaPrev]) {
      r = resolverImputacionNocturnaMarca(marca, {
        celda_d: celdas[fechaPrev],
        celda_d_plus: celdas[fechaCal] || null,
        fecha_ymd_d: fechaPrev,
      });
    } else {
      r = { marca, fecha_imputacion_ymd: fechaCal, advertencias: [] };
    }
    const key = r.fecha_imputacion_ymd;
    if (!porImputacion.has(key)) porImputacion.set(key, []);
    porImputacion.get(key).push(r.marca);
    if (r.advertencias.length) {
      if (!advertenciasRebucketPorDia.has(key)) advertenciasRebucketPorDia.set(key, new Set());
      for (const a of r.advertencias) advertenciasRebucketPorDia.get(key).add(a);
    }
  }

  const resultadoPorDia = {};
  for (const fecha_ymd of [...porImputacion.keys()].sort()) {
    const alineado = alinearMarcasConTeoriaDia({
      marcas: porImputacion.get(fecha_ymd),
      celda_teoria: celdas[fecha_ymd],
      celda_teoria_dia_siguiente: celdas[diaSiguienteYmd(fecha_ymd)],
      fecha_ymd,
    });
    const adv = new Set(alineado.advertencias_fichada_abiertas);
    const reb = advertenciasRebucketPorDia.get(fecha_ymd);
    if (reb) for (const a of reb) adv.add(a);
    resultadoPorDia[fecha_ymd] = {
      ...alineado,
      advertencias_fichada_abiertas: [...adv],
    };
  }

  return { ok: true, dias: resultadoPorDia };
}
