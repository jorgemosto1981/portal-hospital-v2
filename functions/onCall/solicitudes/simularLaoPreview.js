"use strict";

/**
 * Callable — preview simulación LAO (Stock / Proporcional, guardas 01/07 y TSE, matriz).
 * Consumo previsto: UI del portal al completar fechas de solicitud.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const runtimeFlags = require("../../modules/shared/runtimeFlags.json");
const { resolvePersonaIdSolicitudFlujoAgente } = require("../../modules/shared/helpers");
const { parseYmd } = require("../../modules/shared/laoPreviewDateUtils");
const { runLaoAltaMotorCompleto } = require("../../modules/shared/laoAltaMotorCompleto");
const { gatherLaoAltaMotorContext } = require("../../modules/shared/solicitudLaoAltaMotorContext");
const { validarSuperposicionLaoEnMotor } = require("../../modules/shared/laoSuperposicionMotor");
const { assertVersionInvariantForBolsa } = require("../../modules/shared/laoVersionResolver");
const { validarFechasArticuloEnMotor } = require("../../modules/shared/validarFechasArticuloRuntime");
const {
  CODIGO_INCONSISTENCIA_DIAS_CORRIDOS,
  CODIGO_INCONSISTENCIA_DIAS_HABILES,
  mensajeValidacionFechas,
  readModoCalculo,
} = require("../../modules/shared/validarFechasArticulo");
const { MODO_COMPUTO_CORRIDOS } = require("../../modules/shared/modoComputoCalendario");
const {
  evaluarSaldoBolsaParaPreview,
  mergeBolsasFromSaldoDocs,
} = require("../../modules/shared/laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

function resolvePersonaIdParaPreview(request, data) {
  if (runtimeFlags.OPEN_ACCESS_TEMP === true) {
    const pid = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
    if (pid && /^per_/i.test(pid)) return pid;
    throw new HttpsError("failed-precondition", "OPEN_ACCESS_TEMP: enviá persona_id explícito.");
  }
  return resolvePersonaIdSolicitudFlujoAgente(request, data);
}

/**
 * @param {Awaited<ReturnType<typeof validarFechasArticuloEnMotor>>} fechasVal
 * @param {ReturnType<typeof readModoCalculo>} modoCalc
 * @param {string} fechaDesde
 */
function buildResumenComputoRespuesta(fechasVal, modoCalc, fechaDesde) {
  const res = fechasVal.calendario_resumen || {};
  const diasCorridos = Number(res.dias_corridos) || 0;
  const diasHabiles = Number(res.dias_habiles) || 0;
  const diasConsumo = fechasVal.modo_computo === MODO_COMPUTO_CORRIDOS ? diasCorridos : diasHabiles;
  return {
    fecha_desde: fechaDesde,
    fecha_hasta: fechasVal.fecha_hasta,
    modo_computo: fechasVal.modo_computo || modoCalc.modo,
    regla_computo_dias_id: modoCalc.reglaId,
    usa_calendario_institucional: fechasVal.usa_calendario_institucional === true,
    incluye_feriados_institucionales: modoCalc.incluyeFeriadosInstitucionales === true,
    dias_corridos: diasCorridos,
    dias_habiles: diasHabiles,
    dias_consumo: diasConsumo,
    ok: true,
    codigos: [],
    mensajes: [],
  };
}

const simularLaoPreview = onCall(async (request) => {
  try {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = resolvePersonaIdParaPreview(request, d);
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const versionId =
    typeof d.version_aplicada_id === "string"
      ? d.version_aplicada_id.trim()
      : typeof d.version_aplicada === "string"
        ? d.version_aplicada.trim()
        : "";
  const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
  const fechaHastaRaw = typeof d.fecha_hasta === "string" ? d.fecha_hasta.trim().slice(0, 10) : "";
  const fechaHasta = fechaHastaRaw || fechaDesde;
  const diasSolicitados = Number(d.dias_solicitados);
  const anioOrigenBolsa = Number(d.anio_origen_bolsa);

  if (!articuloId || !/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido (art_*).");
  }
  if (!versionId || !/^ver_/i.test(versionId)) {
    throw new HttpsError("invalid-argument", "version_aplicada_id inválido (ver_*).");
  }
  if (!parseYmd(fechaDesde)) {
    throw new HttpsError("invalid-argument", "fecha_desde debe ser YYYY-MM-DD.");
  }
  if (!parseYmd(fechaHasta)) {
    throw new HttpsError("invalid-argument", "fecha_hasta debe ser YYYY-MM-DD.");
  }
  if (!Number.isFinite(diasSolicitados) || diasSolicitados < 1 || !Number.isInteger(diasSolicitados)) {
    throw new HttpsError("invalid-argument", "dias_solicitados debe ser un entero ≥ 1.");
  }
  if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
    throw new HttpsError("invalid-argument", "anio_origen_bolsa inválido.");
  }

  let ctx;
  try {
    ctx = await gatherLaoAltaMotorContext(db, {
      personaId,
      articuloId,
      versionId,
      fechaDesde,
    });
  } catch (err) {
    const code = err && typeof err.code === "string" ? err.code : "failed-precondition";
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "not-found") throw new HttpsError("not-found", msg);
    if (code === "invalid-argument") throw new HttpsError("invalid-argument", msg);
    throw new HttpsError("failed-precondition", msg);
  }

  try {
    assertVersionInvariantForBolsa(ctx.versionData, anioOrigenBolsa);
  } catch (err) {
    throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
  }

  const modoCalc = readModoCalculo(ctx.versionData);
  const fechasVal = await validarFechasArticuloEnMotor(db, {
    versionData: ctx.versionData,
    fechaDesde,
    fechaHasta,
    diasSolicitados,
  });
  if (!fechasVal.ok) {
    throw new HttpsError(
      "failed-precondition",
      fechasVal.mensajes?.length ? fechasVal.mensajes.join(" ") : "Fechas inválidas para la solicitud.",
      { codigos: fechasVal.codigos || [] },
    );
  }

  const resumenComputo = buildResumenComputoRespuesta(fechasVal, modoCalc, fechaDesde);
  if (diasSolicitados !== resumenComputo.dias_consumo) {
    const codigo =
      modoCalc.modo === MODO_COMPUTO_CORRIDOS
        ? CODIGO_INCONSISTENCIA_DIAS_CORRIDOS
        : CODIGO_INCONSISTENCIA_DIAS_HABILES;
    throw new HttpsError("invalid-argument", mensajeValidacionFechas(codigo), { codigos: [codigo] });
  }

  const salSnap = await db.collection(COL_SALDOS).where("persona_id", "==", personaId).get();
  const saldosMerged = mergeBolsasFromSaldoDocs(salSnap.docs.map((doc) => doc.data() || {}));

  const superposicionVal = await validarSuperposicionLaoEnMotor(db, {
    personaId,
    fechaDesdeYmd: fechaDesde,
    fechaHastaYmd: fechaHasta,
    versionData: ctx.versionData,
  });

  const motorBase = {
    versionData: ctx.versionData,
    versionId,
    fechaDesdeYmd: fechaDesde,
    fechaHastaYmd: fechaHasta,
    anioOrigenBolsa,
    hlcArray: ctx.hlcArray,
    diasExternos: ctx.diasExternos,
    exclusionIntervals: ctx.exclusionIntervals,
    operadorCodigoPorId: ctx.operadorMap,
    fechasVal,
    superposicionVal,
    persona: ctx.persona,
    personaId,
  };

  let resultado;
  try {
    resultado = await runLaoAltaMotorCompleto(motorBase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("failed-precondition", msg);
  }

  const saldoVal = evaluarSaldoBolsaParaPreview({
    saldosMerged,
    articuloId,
    anioOrigenBolsa,
    diasSolicitados,
    fechaDesdeYmd: fechaDesde,
    diasProporcionalesPiso: resultado.proporcional?.dias_proporcionales_piso ?? null,
  });

  try {
    resultado = await runLaoAltaMotorCompleto({
      ...motorBase,
      diasSolicitados,
      disponibleBolsa: Number.isFinite(Number(saldoVal.disponible)) ? Number(saldoVal.disponible) : 0,
      saldoEval: saldoVal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("failed-precondition", msg);
  }

  return {
    ...resultado,
    fecha_hasta: fechaHasta,
    dias_solicitados: diasSolicitados,
    resumen_computo: resumenComputo,
    persona_id: personaId,
    articulo_id: articuloId,
    version_aplicada_id: versionId,
    solicitudes_evaluadas: ctx.solicitudesEvaluadas,
    intervalos_excluidos_tse: ctx.intervalosExcluidosTse,
    saldo_preview: {
      disponible: saldoVal.disponible,
      camino: saldoVal.camino,
      bolsa_id: saldoVal.bolsa_id ?? null,
      ok: saldoVal.ok,
    },
  };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("simularLaoPreview unhandled", err);
    throw new HttpsError("failed-precondition", msg || "Error interno al simular LAO.");
  }
});

module.exports = { simularLaoPreview };
