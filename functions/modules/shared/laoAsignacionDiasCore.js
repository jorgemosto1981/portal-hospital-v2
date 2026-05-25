"use strict";

/**
 * Motor de asignación de cupo LAO (gates apertura, TSE, pleno/proporcional).
 * @see docs/v2/RFC_LAO_MOTOR_CONFIG_WIRING_V2.md
 */

const { calcularAntiguedad } = require("./antiguedadCalculator");
const { civilDateInZonaToUtcAnchorMs } = require("./fechaInstitucionalBa");
const { resolveLaoMotorConfig, resolveFechaCorteAntiguedadLao } = require("./laoMotorConfigResolver");
const {
  computeDiasTseServicioEfectivo,
  computeMesesComputablesEjercicio,
} = require("./laoHlcIntervals");
const { anchorFromYmd, parseYmd } = require("./laoPreviewDateUtils");

const MOTOR_VERSION = "lao-preview-v2";

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

function parseMesDiaApertura(mesDia) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(mesDia ?? "").trim());
  if (!m) return null;
  return { mo: Number(m[1]), d: Number(m[2]) };
}

/** Gate 1: MM-DD(fecha_desde) >= mes_dia_apertura (calendario BA). */
function esAperturaValida(fechaDesdeYmd, mesDiaApertura, anioSolicitud) {
  const pDesde = parseYmd(fechaDesdeYmd);
  const pApertura = parseMesDiaApertura(mesDiaApertura);
  if (!pDesde || !pApertura || pDesde.y !== anioSolicitud) return false;
  const tDesde = anchorFromYmd(fechaDesdeYmd);
  const tApertura = civilDateInZonaToUtcAnchorMs(anioSolicitud, pApertura.mo, pApertura.d);
  return tDesde != null && tDesde >= tApertura;
}

function resolveCaminoBolsa(anioSolicitud, anioImputado) {
  if (anioSolicitud > anioImputado) return "stock";
  if (anioSolicitud < anioImputado) return "error_ano";
  return "proporcional";
}

/**
 * @param {object} params
 */
function runLaoAsignacionDiasCore(params) {
  const {
    versionData,
    fechaDesdeYmd,
    fechaHastaYmd,
    anioOrigenBolsa,
    anioCalendarioActual,
    hlcArray = [],
    diasExternos = 0,
    exclusionIntervals = [],
    operadorCodigoPorId = {},
  } = params;

  const pDesde = parseYmd(fechaDesdeYmd);
  const pHasta = parseYmd(fechaHastaYmd);
  if (!pDesde || !pHasta) {
    return {
      ok: false,
      eligible: false,
      motor_version: MOTOR_VERSION,
      codigos: [{ codigo: "ERROR_FECHAS", fase: "L", nivel: "bloqueante" }],
      motivos_ineligibilidad: ["fecha_desde o fecha_hasta inválida."],
    };
  }

  const anioSolicitud = pDesde.y;
  const anioImputado = Number(anioOrigenBolsa);
  if (!Number.isInteger(anioImputado) || anioImputado < 1900) {
    return {
      ok: false,
      eligible: false,
      motor_version: MOTOR_VERSION,
      codigos: [{ codigo: "ERROR_ANIO_IMPUTADO", fase: "L", nivel: "bloqueante" }],
      motivos_ineligibilidad: ["anio_origen_bolsa inválido."],
    };
  }

  const config = resolveLaoMotorConfig(versionData);
  const caminoBolsa = resolveCaminoBolsa(anioSolicitud, anioImputado);
  const fechaCorteAplicada = resolveFechaCorteAntiguedadLao(versionData, anioImputado);

  const resultadoAntiguedad = calcularAntiguedad(
    Array.isArray(hlcArray) ? hlcArray : [],
    fechaCorteAplicada,
    diasExternos,
  );
  const totalDias = Number(resultadoAntiguedad.totalDiasCalculados) || 0;
  const antiguedadAniosDecimal = totalDias / 365;
  const escalon = pickMatrizEscalon(config.matrizReglas, antiguedadAniosDecimal, operadorCodigoPorId);
  const diasBase =
    escalon && Number.isFinite(Number(escalon.dias_otorgados)) ? Number(escalon.dias_otorgados) : null;

  const tseBlock = computeDiasTseServicioEfectivo({
    hlcArray,
    anioActual: anioSolicitud,
    fechaHastaYmd,
    exclusionIntervals,
  });

  const anioActualRef = Number(anioCalendarioActual ?? anioSolicitud);
  const motivos = [];
  const codigos = [];

  if (caminoBolsa === "error_ano") {
    codigos.push({ codigo: "ANO_SOLICITUD_MENOR_ORIGEN", fase: "L", nivel: "bloqueante" });
    motivos.push("El año de la fecha de inicio no puede ser menor que el año de origen de la bolsa.");
    return buildResult({
      eligible: false,
      caminoBolsa,
      caminoAsignacion: "rechazado",
      config,
      fechaCorteAplicada,
      tseBlock,
      diasBase,
      escalon,
      antiguedadAniosDecimal,
      resultadoAntiguedad,
      cupo: null,
      motivos,
      codigos,
      anioSolicitud,
      anioImputado,
      fechaDesdeYmd,
      fechaHastaYmd,
    });
  }

  if (caminoBolsa === "stock") {
    if (diasBase == null) {
      codigos.push({ codigo: "ERROR_MATRIZ_SIN_ESCALON", fase: "L", nivel: "bloqueante" });
      motivos.push("No hay escalón de matriz aplicable.");
    }
    return buildResult({
      eligible: diasBase != null,
      caminoBolsa,
      caminoAsignacion: "stock",
      config,
      fechaCorteAplicada,
      tseBlock,
      diasBase,
      escalon,
      antiguedadAniosDecimal,
      resultadoAntiguedad,
      cupo: diasBase,
      motivos,
      codigos,
      anioSolicitud,
      anioImputado,
      fechaDesdeYmd,
      fechaHastaYmd,
    });
  }

  const aperturaOk = esAperturaValida(fechaDesdeYmd, config.mesDiaApertura, anioSolicitud);
  if (!aperturaOk) {
    codigos.push({ codigo: "ERROR_APERTURA_TEMPORADA", fase: "L", nivel: "bloqueante" });
    motivos.push(`Guarda apertura: fecha_desde debe ser en o después del ${config.mesDiaApertura} (BA).`);
  }

  const tseOk = tseBlock.diasTse >= config.tseMinimoDiasBase;
  let caminoAsignacion = "rechazado";
  let cupo = null;
  let mesesEjercicio = null;

  if (diasBase == null) {
    codigos.push({ codigo: "ERROR_MATRIZ_SIN_ESCALON", fase: "L", nivel: "bloqueante" });
    motivos.push("No hay escalón de matriz aplicable.");
  } else if (aperturaOk && tseOk) {
    caminoAsignacion = "pleno";
    cupo = diasBase;
  } else if (aperturaOk && !tseOk) {
    if (config.permiteProporcional && anioImputado === anioActualRef) {
      mesesEjercicio = computeMesesComputablesEjercicio(hlcArray, anioImputado);
      const mesesProp = mesesEjercicio.meses;
      if (mesesProp > 0) {
        caminoAsignacion = "proporcional";
        cupo = Math.floor((diasBase / 12) * mesesProp);
      } else {
        codigos.push({ codigo: "ERROR_TSE_INSUFICIENTE", fase: "L", nivel: "bloqueante" });
        motivos.push("TSE insuficiente y sin meses computables para proporcional.");
      }
    } else if (!config.permiteProporcional) {
      codigos.push({ codigo: "ERROR_TSE_INSUFICIENTE", fase: "L", nivel: "bloqueante" });
      motivos.push(`TSE (${tseBlock.diasTse}) inferior al mínimo (${config.tseMinimoDiasBase}).`);
    } else {
      codigos.push({ codigo: "ERROR_TSE_INSUFICIENTE_ANIO_VENCIDO", fase: "L", nivel: "bloqueante" });
      motivos.push("TSE insuficiente para bolsa de ejercicio anterior.");
    }
  }

  const eligible = aperturaOk && caminoAsignacion !== "rechazado" && cupo != null && diasBase != null;

  return buildResult({
    eligible,
    caminoBolsa,
    caminoAsignacion,
    config,
    fechaCorteAplicada,
    tseBlock,
    diasBase,
    escalon,
    antiguedadAniosDecimal,
    resultadoAntiguedad,
    cupo,
    motivos,
    codigos,
    anioSolicitud,
    anioImputado,
    fechaDesdeYmd,
    fechaHastaYmd,
    mesesEjercicio,
    guardas: { aperturaOk, tseOk },
  });
}

function buildResult(ctx) {
  const {
    eligible,
    caminoBolsa,
    caminoAsignacion,
    config,
    fechaCorteAplicada,
    tseBlock,
    diasBase,
    escalon,
    antiguedadAniosDecimal,
    resultadoAntiguedad,
    cupo,
    motivos,
    codigos,
    anioSolicitud,
    anioImputado,
    fechaDesdeYmd,
    fechaHastaYmd,
    mesesEjercicio = null,
    guardas = null,
  } = ctx;

  return {
    ok: true,
    eligible: Boolean(eligible),
    motor_version: MOTOR_VERSION,
    camino_bolsa: caminoBolsa,
    camino_asignacion: caminoAsignacion,
    anio_solicitud: anioSolicitud,
    anio_origen_bolsa: anioImputado,
    fecha_desde: fechaDesdeYmd,
    fecha_hasta: fechaHastaYmd,
    motivos_ineligibilidad: motivos,
    codigos,
    config_usada: {
      tse_minimo_dias_base: config.tseMinimoDiasBase,
      mes_dia_apertura_solicitudes: config.mesDiaApertura,
      permite_calculo_proporcional_tse: config.permiteProporcional,
    },
    asignacion: {
      camino: caminoAsignacion,
      cupo,
      dias_tse: tseBlock.diasTse,
      tse_minimo_aplicado: config.tseMinimoDiasBase,
      dias_base_matriz: diasBase,
      fecha_corte_aplicada: fechaCorteAplicada,
      meses_computables_ejercicio: mesesEjercicio?.meses ?? null,
    },
    antiguedad: {
      totalDiasCalculados: Number(resultadoAntiguedad.totalDiasCalculados) || 0,
      antiguedad_anios_decimal: Math.round(antiguedadAniosDecimal * 1000) / 1000,
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
    guardas: guardas
      ? {
          apertura: guardas.aperturaOk,
          tse: guardas.tseOk,
        }
      : undefined,
  };
}

module.exports = {
  MOTOR_VERSION,
  esAperturaValida,
  pickMatrizEscalon,
  resolveCaminoBolsa,
  runLaoAsignacionDiasCore,
};
