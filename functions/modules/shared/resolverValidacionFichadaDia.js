"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.

const { obtenerYmdHoyInstitucional } = require("./fechaInstitucionalBa");
const { calcularDeltasCumplimiento } = require("./calcularDeltasCumplimiento");
const {
  celdaEsperaFichada,
  celdaTieneCapaFichadaCargada,
  celdaTieneFichadaImpar,
  parseFichadasRealesCelda,
} = require("./grillaFichadaPresencia");
const {
  celdaSinExpectativaFichada,
  licenciaCubreDiaFichada,
} = require("./licenciaCubreDiaFichada");
const {
  construirPartesFingerprintValidacionFichada,
  fingerprintValidacionFichadaDia,
} = require("./validacionFichadaDiaFingerprint");

/**
 * RFC Fase F — orquestador validación fichada persistida (semáforo V/A/R).
 */





const ESTADO_SEMAFORO = {
  VERDE: "VERDE",
  AMARILLO: "AMARILLO",
  ROJO: "ROJO",
};

const HERRAMIENTA_POR_CODIGO = {
  MARCA_IMPAR: "DERIVAR_RRHH_MARCA_MANUAL",
  FICHADA_FUERA_TURNO_TEORICO: "CAMBIO_INTERCAMBIO_TURNO_EXISTENTE",
  TARDANZA_PUNITIVA: "SOLICITAR_LICENCIA_FRANQUICIA",
  SALIDA_ANTICIPADA: "SOLICITAR_LICENCIA_FRANQUICIA",
  DEFICIT_HORARIO_GRAVE: "SOLICITAR_LICENCIA_FRANQUICIA",
  FUERA_MARGEN_HORARIO: "SOLICITAR_LICENCIA_FRANQUICIA",
  AUSENCIA_AUTOMATICA: "SOLICITAR_LICENCIA_FRANQUICIA",
  AUSENCIA_SIN_MARCAS: "DERIVAR_RRHH_MARCA_MANUAL",
};

const TEXTO_ALERTA = {
  TARDANZA_PUNITIVA: "Ingreso fuera del margen de cortesía del régimen.",
  SALIDA_ANTICIPADA: "Egreso antes del margen teórico.",
  DEFICIT_HORARIO_GRAVE: "Déficit de carga horaria por encima de la tolerancia de débito.",
  FICHADA_FUERA_TURNO_TEORICO: "Marcas no coinciden con la ventana del turno teórico.",
  FUERA_MARGEN_HORARIO: "Horario fuera de los márgenes de tolerancia.",
  AUSENCIA_AUTOMATICA: "Ausencia sin marcas tras la ventana de evaluación.",
  MARCA_IMPAR: "Cantidad de marcas incompleta respecto a lo esperado.",
  AUSENCIA_SIN_MARCAS: "Sin marcas registradas; día con expectativa de fichada.",
};

/**
 * @param {Record<string, unknown>|null|undefined} full
 */
function compactarValidacionParaListado(full) {
  if (!full || typeof full !== "object") return null;
  return {
    estado_semaforo: full.estado_semaforo,
    texto_resumen: full.texto_resumen,
    eval_estable: full.eval_estable === true,
    eval_fingerprint: full.eval_fingerprint,
    evaluado_en: full.evaluado_en,
  };
}

/**
 * @param {string} codigo
 * @param {Record<string, unknown>} analitica
 */
function textoHumanoAlerta(codigo, analitica) {
  if (codigo === "TARDANZA_PUNITIVA") {
    const m = Number(analitica?.disciplina?.tardanza_minutos) || 0;
    return m > 0 ? `Tardanza: ${m} min respecto al ingreso nominal.` : TEXTO_ALERTA[codigo];
  }
  if (codigo === "SALIDA_ANTICIPADA") {
    const m = Number(analitica?.disciplina?.salida_anticipada_minutos) || 0;
    return m > 0 ? `Salida anticipada: ${m} min.` : TEXTO_ALERTA[codigo];
  }
  if (codigo === "DEFICIT_HORARIO_GRAVE") {
    const m = Number(analitica?.debito_tiempo?.deficit_minutos) || 0;
    return m > 0 ? `Déficit horario: ${m} min.` : TEXTO_ALERTA[codigo];
  }
  return TEXTO_ALERTA[codigo] || codigo;
}

/**
 * @param {string[]} codigos
 * @param {Record<string, unknown>} analitica
 */
function alertasSemanticasDesdeCodigos(codigos, analitica) {
  const out = [];
  const vistos = new Set();
  for (const codigo of codigos) {
    const c = String(codigo || "").trim();
    if (!c || vistos.has(c)) continue;
    vistos.add(c);
    /** @type {Record<string, unknown>} */
    const alerta = {
      codigo: c,
      texto_humano: textoHumanoAlerta(c, analitica),
      herramienta_sugerida: HERRAMIENTA_POR_CODIGO[c] || "SOLICITAR_LICENCIA_FRANQUICIA",
    };
    if (c === "TARDANZA_PUNITIVA") {
      alerta.minutos_desvio = Number(analitica?.disciplina?.tardanza_minutos) || 0;
    }
    if (c === "SALIDA_ANTICIPADA") {
      alerta.minutos_desvio = Number(analitica?.disciplina?.salida_anticipada_minutos) || 0;
    }
    out.push(alerta);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} celda
 * @param {Record<string, unknown>} analitica
 */
function derivarCodigosAlerta(celda, analitica) {
  /** @type {string[]} */
  const codigos = [];
  const activas = Array.isArray(analitica.alertas_activas) ? analitica.alertas_activas : [];
  for (const a of activas) codigos.push(String(a));

  if (celdaTieneFichadaImpar(celda) && !codigos.includes("MARCA_IMPAR")) {
    codigos.push("MARCA_IMPAR");
  }

  const capa = celdaTieneCapaFichadaCargada(celda);
  const tieneMarcas = parseFichadasRealesCelda(celda).length > 0;
  const espera = celdaEsperaFichada(celda);
  if (capa && espera && !tieneMarcas && !analitica.ausencia_automatica && !codigos.includes("AUSENCIA_SIN_MARCAS")) {
    codigos.push("AUSENCIA_SIN_MARCAS");
  }

  const advertencias = Array.isArray(celda.advertencias_fichada_abiertas)
    ? celda.advertencias_fichada_abiertas.filter(Boolean)
    : [];
  if (advertencias.length > 0 && !codigos.length) {
    codigos.push("FUERA_MARGEN_HORARIO");
  }

  return codigos;
}

/**
 * @param {Record<string, unknown>} celda
 * @param {Record<string, unknown>} analitica
 * @param {string} estado_semaforo
 */
function textoResumenValidacion(celda, analitica, estado_semaforo) {
  if (celda.resuelto_rrhh === true) return "Revisado y saneado por RRHH.";
  if (estado_semaforo === ESTADO_SEMAFORO.VERDE) return "Asistencia conforme al turno teórico.";
  if (estado_semaforo === ESTADO_SEMAFORO.ROJO) {
    if (analitica.ausencia_automatica) return "Ausencia sin marcas (ventana de evaluación cerrada).";
    return "Incumplimiento grave — sin marcas en día con expectativa de fichada.";
  }
  const codigos = derivarCodigosAlerta(celda, analitica);
  const primera = codigos[0];
  if (primera && TEXTO_ALERTA[primera]) return TEXTO_ALERTA[primera];
  return "Divergencia entre fichada y expectativa teórica.";
}

/**
 * @param {Record<string, unknown>} celda
 * @param {Record<string, unknown>} analitica
 */
function mapearEstadoSemaforo(celda, analitica) {
  if (analitica.ausencia_automatica === true) return ESTADO_SEMAFORO.ROJO;

  const capa = celdaTieneCapaFichadaCargada(celda);
  const tieneMarcas = parseFichadasRealesCelda(celda).length > 0;
  const espera = celdaEsperaFichada(celda);

  if (capa && espera && !tieneMarcas) {
    return ESTADO_SEMAFORO.AMARILLO;
  }

  if (celda.resuelto_rrhh === true && tieneMarcas) return ESTADO_SEMAFORO.VERDE;

  const codigos = derivarCodigosAlerta(celda, analitica);
  const divergenciaAnalitica = (Array.isArray(analitica.alertas_activas) && analitica.alertas_activas.length > 0)
    || analitica.fichada_fuera_turno_teorico === true;

  if (celdaTieneFichadaImpar(celda) || divergenciaAnalitica || codigos.some((c) => c !== "AUSENCIA_SIN_MARCAS" && c)) {
    return ESTADO_SEMAFORO.AMARILLO;
  }

  if (codigos.includes("AUSENCIA_SIN_MARCAS")) {
    return ESTADO_SEMAFORO.AMARILLO;
  }

  if (tieneMarcas) return ESTADO_SEMAFORO.VERDE;

  return ESTADO_SEMAFORO.AMARILLO;
}

/**
 * @param {object} params
 * @param {Record<string, unknown>|null|undefined} params.celda
 * @param {Record<string, unknown>} [params.capaTeoricaGrupo]
 * @param {unknown} [params.eventos]
 * @param {string} params.fecha_ymd
 * @param {number} [params.ahora_evaluacion_ms]
 * @param {Record<string, unknown>|null|undefined} [params.analitica_existente]
 * @param {Record<string, unknown>|null|undefined} [params.validacion_existente]
 * @param {boolean} [params.forzar_recalculo]
 */
function resolverValidacionFichadaDia(params) {
  const celda = params.celda && typeof params.celda === "object" ? params.celda : {};
  const capaTeoricaGrupo = params.capaTeoricaGrupo && typeof params.capaTeoricaGrupo === "object"
    ? params.capaTeoricaGrupo
    : {};
  const fecha_ymd = String(params.fecha_ymd || "").slice(0, 10);
  const ahoraMs = Number.isFinite(Number(params.ahora_evaluacion_ms))
    ? Number(params.ahora_evaluacion_ms)
    : Date.now();
  const hoy = obtenerYmdHoyInstitucional(ahoraMs);

  if (fecha_ymd > hoy) {
    return { accion: "omit", motivo: "dia_futuro" };
  }

  if (licenciaCubreDiaFichada(celda, params.eventos)) {
    return { accion: "delete", motivo: "licencia_cubre_dia" };
  }

  if (celdaSinExpectativaFichada(celda)) {
    return { accion: "omit", motivo: "sin_expectativa_fichada" };
  }

  const licencia_cubre = false;
  const analitica = params.analitica_existente && typeof params.analitica_existente === "object" && !params.forzar_recalculo
    ? params.analitica_existente
    : calcularDeltasCumplimiento(celda, capaTeoricaGrupo, {
        fecha_ymd,
        ahora_evaluacion_ms: ahoraMs,
      });

  const partesFp = construirPartesFingerprintValidacionFichada({
    fecha_ymd,
    celda,
    capaTeoricaGrupo,
    licencia_cubre_dia: licencia_cubre,
    analitica_version: analitica.version,
  });
  const eval_fingerprint = fingerprintValidacionFichadaDia(partesFp);

  const prev = params.validacion_existente;
  if (
    !params.forzar_recalculo
    && prev
    && typeof prev === "object"
    && prev.eval_estable === true
    && String(prev.eval_fingerprint || "") === eval_fingerprint
  ) {
    return { accion: "skip", eval_fingerprint, validacion_fichada_dia: prev };
  }

  const estado_semaforo = mapearEstadoSemaforo(celda, analitica);
  const codigos = derivarCodigosAlerta(celda, analitica);
  const alertas_semanticas = alertasSemanticasDesdeCodigos(codigos, analitica);
  const texto_resumen = textoResumenValidacion(celda, analitica, estado_semaforo);
  const evaluado_en = new Date(ahoraMs).toISOString();

  const validacion_fichada_dia = {
    estado_semaforo,
    texto_resumen,
    eval_estable: true,
    eval_fingerprint,
    evaluado_en,
    alertas_semanticas,
    editable_por_jefe: true,
    motivo_bloqueo: null,
  };

  return {
    accion: "write",
    eval_fingerprint,
    validacion_fichada_dia,
    analitica,
  };
}

module.exports = { ESTADO_SEMAFORO, compactarValidacionParaListado, resolverValidacionFichadaDia };
