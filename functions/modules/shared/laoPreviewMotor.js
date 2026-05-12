"use strict";

/**
 * Simulador LAO (preview) — lógica pura compartida con el callable.
 * Contrato normativo: docs/v2/MODULO_ARTICULOS_V2_SCHEMA_PRODUCT_FIRST.md §4.1 (Stock / Proporcional, TSE, 01/07).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const { civilDateInZonaToUtcAnchorMs, formatYmdEnZona, ymdEnZonaDesdeInstante } = require("./fechaInstitucionalBa");
const { calcularAntiguedad } = require("./antiguedadCalculator");

const TSE_MIN_DIAS = 180;

function parseYmd(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function anchorFromYmd(ymd) {
  const p = parseYmd(ymd);
  if (!p) return null;
  try {
    return civilDateInZonaToUtcAnchorMs(p.y, p.mo, p.d);
  } catch {
    return null;
  }
}

/** @param {{ inicioUtc: number, finUtc: number }[]} intervals */
function mergeClosedIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.inicioUtc - b.inicioUtc);
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.inicioUtc <= last.finUtc + MS_PER_DAY) {
      if (cur.finUtc > last.finUtc) last.finUtc = cur.finUtc;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function dayCoveredByMerged(t, merged) {
  for (const iv of merged) {
    if (t >= iv.inicioUtc && t <= iv.finUtc) return true;
  }
  return false;
}

/**
 * TSE: días civiles en [01/01 año .. fecha_desde] BA que no caen en intervalos excluidos (licencias sin suma_antiguedad_lao).
 * `mesesConDiaEfectivo`: cantidad de meses calendario (YYYY-MM) con al menos un día efectivo (para proporcional §7).
 */
function computeTseYMeses({ year, fechaDesdeYmd, exclusionIntervals }) {
  const p = parseYmd(fechaDesdeYmd);
  if (!p || p.y !== year) {
    throw new Error("fecha_desde inválida o no coincide con el año civil de evaluación.");
  }
  const t0 = civilDateInZonaToUtcAnchorMs(year, 1, 1);
  const t1 = civilDateInZonaToUtcAnchorMs(p.y, p.mo, p.d);
  if (t1 < t0) throw new Error("fecha_desde anterior al 01/01 del año.");
  const merged = mergeClosedIntervals(exclusionIntervals);
  let diasTse = 0;
  const meses = new Set();
  for (let t = t0; t <= t1; t += MS_PER_DAY) {
    if (dayCoveredByMerged(t, merged)) continue;
    diasTse += 1;
    meses.add(formatYmdEnZona(t).slice(0, 7));
  }
  return { diasTse, mesesConDiaEfectivo: meses.size, mesesKeys: [...meses].sort() };
}

function sortMatrizRows(matriz) {
  const arr = Array.isArray(matriz) ? [...matriz] : [];
  arr.sort((a, b) => {
    const va = Number(a?.valor_anos);
    const vb = Number(b?.valor_anos);
    const na = Number.isFinite(va) ? va : null;
    const nb = Number.isFinite(vb) ? vb : null;
    if (na === null && nb === null) return 0;
    if (na === null) return 1;
    if (nb === null) return -1;
    if (na !== nb) return na - nb;
    return String(a?.operador_id ?? "").localeCompare(String(b?.operador_id ?? ""));
  });
  return arr;
}

function operadorMatch(codigo, antiguedadDecimal, umbral) {
  const c = String(codigo || "GTE").toUpperCase();
  switch (c) {
    case "GTE":
      return antiguedadDecimal >= umbral;
    case "LTE":
      return antiguedadDecimal <= umbral;
    case "EQ":
      return antiguedadDecimal === umbral;
    case "NE":
      return antiguedadDecimal !== umbral;
    default:
      return false;
  }
}

/**
 * Último escalón que cumple (recorrido ascendente por valor_anos).
 */
function pickMatrizEscalon(matriz, antiguedadAniosDecimal, operadorCodigoPorId) {
  const rows = sortMatrizRows(matriz).filter((r) => r && r.operador_id && Number.isFinite(Number(r.valor_anos)));
  let chosen = null;
  for (const r of rows) {
    const code = operadorCodigoPorId[String(r.operador_id)] || "GTE";
    if (operadorMatch(code, antiguedadAniosDecimal, Number(r.valor_anos))) {
      chosen = r;
    }
  }
  return chosen;
}

/**
 * @param {object} params
 * @param {string} params.fechaDesdeYmd
 * @param {number} params.anioOrigenBolsa
 * @param {unknown[]} params.hlcArray
 * @param {unknown} [params.diasExternos]
 * @param {{ inicioUtc: number, finUtc: number }[]} params.exclusionIntervals
 * @param {object} params.versionData — doc `cfg_articulos/.../versiones/...`
 * @param {Record<string, string>} params.operadorCodigoPorId — `operador_id` → `codigo_interno` (cfg_operador_comparacion)
 */
function runLaoPreviewSimulacion(params) {
  const {
    fechaDesdeYmd,
    anioOrigenBolsa,
    hlcArray,
    diasExternos = 0,
    exclusionIntervals,
    versionData,
    operadorCodigoPorId,
  } = params;

  const p = parseYmd(fechaDesdeYmd);
  if (!p) throw new Error("fecha_desde inválida (YYYY-MM-DD).");

  const anioSolicitud = p.y;
  const anioNum = Number(anioOrigenBolsa);
  if (!Number.isInteger(anioNum) || anioNum < 1900) {
    throw new Error("anio_origen_bolsa inválido.");
  }

  let camino;
  if (anioSolicitud > anioNum) camino = "stock";
  else if (anioSolicitud < anioNum) camino = "error_ano";
  else camino = "proporcional";

  const ident = versionData?.bloque_identidad_naturaleza || {};
  if (ident.es_lao_anual !== true) {
    throw new Error("La versión del artículo no está marcada como LAO anual (bloque_identidad_naturaleza.es_lao_anual).");
  }

  const resultadoAntiguedad = calcularAntiguedad(Array.isArray(hlcArray) ? hlcArray : [], fechaDesdeYmd, diasExternos);
  const totalDias = Number(resultadoAntiguedad.totalDiasCalculados) || 0;
  const antiguedadAniosDecimal = totalDias / 365;

  const topes = versionData?.bloque_topes_plazos_computo || {};
  const matriz = Array.isArray(topes.matriz_antiguedad_reglas) ? topes.matriz_antiguedad_reglas : [];

  const escalon = pickMatrizEscalon(matriz, antiguedadAniosDecimal, operadorCodigoPorId || {});
  const diasBase = escalon && Number.isFinite(Number(escalon.dias_otorgados)) ? Number(escalon.dias_otorgados) : null;

  const tseBlock = computeTseYMeses({
    year: anioSolicitud,
    fechaDesdeYmd,
    exclusionIntervals: Array.isArray(exclusionIntervals) ? exclusionIntervals : [],
  });

  const tJulio = civilDateInZonaToUtcAnchorMs(anioSolicitud, 7, 1);
  const tDesde = anchorFromYmd(fechaDesdeYmd);
  const guardaJulioOk = camino !== "proporcional" ? true : tDesde != null && tDesde >= tJulio;
  const guardaTseOk = camino !== "proporcional" ? true : tseBlock.diasTse >= TSE_MIN_DIAS;

  const mesesProp = tseBlock.mesesConDiaEfectivo;
  const diasProporcionalesPiso =
    camino === "proporcional" && guardaJulioOk && guardaTseOk && diasBase != null && mesesProp > 0
      ? Math.floor((diasBase / 12) * mesesProp)
      : null;

  const motivosIneligibilidad = [];
  if (camino === "error_ano") {
    motivosIneligibilidad.push("El año de la fecha de inicio no puede ser menor que el año de origen de la bolsa.");
  }
  if (camino === "proporcional") {
    if (!guardaJulioOk) {
      motivosIneligibilidad.push(
        "Guarda 01/07: la fecha de inicio debe ser el 1 de julio o posterior (calendario Buenos Aires).",
      );
    }
    if (!guardaTseOk) {
      motivosIneligibilidad.push(
        `TSE insuficiente: se requieren al menos ${TSE_MIN_DIAS} días de servicio efectivo en el año civil (tras excluir licencias con suma_antiguedad_lao = false).`,
      );
    }
    if (diasBase == null) {
      motivosIneligibilidad.push("No hay escalón de matriz de antigüedad aplicable para definir días base.");
    }
  }
  const eligible = camino === "stock" || (camino === "proporcional" && guardaJulioOk && guardaTseOk && diasBase != null);

  return {
    ok: true,
    eligible,
    motivos_ineligibilidad: motivosIneligibilidad,
    motor_version: "lao-preview-v1",
    zona_horaria: "America/Argentina/Buenos_Aires",
    camino,
    anio_solicitud: anioSolicitud,
    anio_origen_bolsa: anioNum,
    fecha_desde: fechaDesdeYmd,
    antiguedad: {
      totalDiasCalculados: totalDias,
      amd_final: {
        años: resultadoAntiguedad.años,
        meses: resultadoAntiguedad.meses,
        dias: resultadoAntiguedad.dias,
      },
      antiguedad_anios_decimal: Math.round(antiguedadAniosDecimal * 1000) / 1000,
      detalle_calculo: resultadoAntiguedad.detalleCalculo,
    },
    guardas: {
      julio_primero: {
        aplica: camino === "proporcional",
        ok: guardaJulioOk,
        detalle:
          camino !== "proporcional"
            ? "Camino Stock: no exige guarda 01/07."
            : guardaJulioOk
              ? "fecha_desde es en o después del 01/07 (calendario Buenos Aires)."
              : "Proporcional: fecha_desde anterior al 01/07 (Buenos Aires).",
      },
      tse_180: {
        aplica: camino === "proporcional",
        ok: guardaTseOk,
        dias_tse: tseBlock.diasTse,
        minimo: TSE_MIN_DIAS,
        meses_con_dia_efectivo: mesesProp,
        detalle:
          camino !== "proporcional"
            ? "Camino Stock: no exige TSE 6 meses."
            : guardaTseOk
              ? `TSE (${tseBlock.diasTse} días) ≥ ${TSE_MIN_DIAS} (días calendario con exclusión de licencias sin suma_antiguedad_lao).`
              : `TSE insuficiente (${tseBlock.diasTse} días < ${TSE_MIN_DIAS}).`,
      },
    },
    matriz: {
      escalon_elegido: escalon
        ? {
            operador_id: escalon.operador_id,
            valor_anos: escalon.valor_anos,
            dias_otorgados: escalon.dias_otorgados,
          }
        : null,
      dias_base: diasBase,
    },
    proporcional: {
      aplica: camino === "proporcional",
      meses_para_formula: mesesProp,
      dias_proporcionales_piso: diasProporcionalesPiso,
      formula: "floor((dias_base / 12) * meses_con_dia_efectivo)",
    },
    stock: {
      aplica: camino === "stock",
      nota: "Consumo de saldo cerrado; sin guardas 01/07 ni proporcional en esta simulación.",
    },
    error: camino === "error_ano" ? { codigo: "ANO_SOLICITUD_MENOR_ORIGEN", mensaje: "No se consume saldo de un año futuro respecto a la bolsa." } : null,
  };
}

module.exports = {
  runLaoPreviewSimulacion,
  computeTseYMeses,
  mergeClosedIntervals,
  parseYmd,
  anchorFromYmd,
  TSE_MIN_DIAS,
  ymdEnZonaDesdeInstante,
};
