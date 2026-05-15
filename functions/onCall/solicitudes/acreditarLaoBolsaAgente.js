"use strict";

/**
 * Callable — acreditación LAO (años >= A): abre bolsa motor sin pisar arrastre check-in.
 * @see docs/v2/RFC_LAO_ACREDITACION_ANUAL_V2.md
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../../modules/shared/context");
const { tokenHasRrhhAccess } = require("../../modules/shared/helpers");
const { runLaoPreviewSimulacion } = require("../../modules/shared/laoPreviewMotor");
const { gatherLaoAltaMotorContext } = require("../../modules/shared/solicitudLaoAltaMotorContext");
const { versionMatchesAnioOrigen } = require("../../modules/shared/laoVersionResolver");
const { resolvePublishedLaoVersion } = require("../../modules/shared/laoVersionResolverDb");
const {
  saldoAnualDocId,
  buildBolsaPayload,
  pickBolsaParaConsumo,
  CFG_OS_INTERNO,
} = require("../../modules/shared/laoSaldosBolsa");

const COL_SALDOS = "saldos_articulo_agente";

function assertRrhh(request) {
  if (!request.auth || !tokenHasRrhhAccess(request.auth.token)) {
    throw new HttpsError("permission-denied", "Solo RRHH puede acreditar bolsas LAO.");
  }
}

function resolveDiasAcreditacion(resultado) {
  if (!resultado || !resultado.eligible) return 0;
  if (resultado.camino === "stock") return Number(resultado.matriz?.dias_base) || 0;
  if (resultado.camino === "proporcional") {
    return Number(resultado.proporcional?.dias_proporcionales_piso) || 0;
  }
  return 0;
}

const acreditarLaoBolsaAgente = onCall(async (request) => {
  assertRrhh(request);

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
  const anioOrigen = Number(d.anio_origen);
  const anioCorteA = d.anio_corte_a != null ? Number(d.anio_corte_a) : null;
  let versionId = typeof d.version_id === "string" ? d.version_id.trim() : "";
  const cantidadManual = d.cantidad_inicial != null ? Number(d.cantidad_inicial) : null;

  if (!/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!/^art_/i.test(articuloId)) {
    throw new HttpsError("invalid-argument", "articulo_id inválido.");
  }
  if (!Number.isInteger(anioOrigen) || anioOrigen < 1900) {
    throw new HttpsError("invalid-argument", "anio_origen inválido.");
  }
  if (anioCorteA != null && Number.isInteger(anioCorteA) && anioOrigen < anioCorteA) {
    throw new HttpsError(
      "invalid-argument",
      `anio_origen (${anioOrigen}) debe ser >= anio_corte_a (${anioCorteA}) para acreditación motor.`,
    );
  }

  if (!versionId) {
    const resolved = await resolvePublishedLaoVersion(db, articuloId, anioOrigen);
    versionId = resolved.versionId;
  }

  const versionSnap = await db
    .collection("cfg_articulos")
    .doc(articuloId)
    .collection("versiones")
    .doc(versionId)
    .get();
  if (!versionSnap.exists) {
    throw new HttpsError("not-found", "La versión del artículo no existe.");
  }
  const versionData = versionSnap.data() || {};
  if (!versionMatchesAnioOrigen(versionData, anioOrigen)) {
    throw new HttpsError(
      "invalid-argument",
      "correspondencia_anio de la versión no coincide con anio_origen.",
    );
  }

  const salId = saldoAnualDocId(personaId, anioOrigen);
  if (!salId) {
    throw new HttpsError("invalid-argument", "saldo anual inválido.");
  }

  const salRef = db.collection(COL_SALDOS).doc(salId);
  const salSnap = await salRef.get();
  const salData = salSnap.exists ? salSnap.data() || {} : {};
  const existente = pickBolsaParaConsumo(salData, articuloId, anioOrigen);
  if (existente?.bolsa?.es_arrastre === true) {
    throw new HttpsError(
      "failed-precondition",
      `Bolsa ${anioOrigen} es arrastre de check-in; no se acredita por motor.`,
    );
  }
  if (existente) {
    const cons = Number(existente.bolsa.consumido) || 0;
    if (cons > 0) {
      throw new HttpsError(
        "already-exists",
        `Bolsa ${anioOrigen} ya tiene consumo (${cons} días).`,
      );
    }
  }

  let cantidadInicial = cantidadManual;
  if (cantidadInicial == null || !Number.isFinite(cantidadInicial)) {
    const fechaDesde = `${anioOrigen}-07-01`;
    const ctx = await gatherLaoAltaMotorContext(db, {
      personaId,
      articuloId,
      versionId,
      fechaDesde,
    });
    const resultado = runLaoPreviewSimulacion({
      fechaDesdeYmd: fechaDesde,
      anioOrigenBolsa: anioOrigen,
      hlcArray: ctx.hlcArray,
      diasExternos: ctx.diasExternos,
      exclusionIntervals: ctx.exclusionIntervals,
      versionData: ctx.versionData,
      operadorCodigoPorId: ctx.operadorMap,
    });
    if (!resultado.eligible) {
      throw new HttpsError(
        "failed-precondition",
        (resultado.motivos_ineligibilidad || []).join(" ") || "Motor no habilita acreditación.",
      );
    }
    cantidadInicial = resolveDiasAcreditacion(resultado);
  }

  if (!Number.isFinite(cantidadInicial) || cantidadInicial < 0) {
    throw new HttpsError("failed-precondition", "No se pudo determinar cantidad_inicial.");
  }

  const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
  const codigoGrilla =
    (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "LAO";

  const { bolsaId, bolsa } = buildBolsaPayload({
    articuloId,
    versionId,
    codigoGrilla: String(codigoGrilla),
    anioOrigen,
    cantidadInicial,
    esArrastre: false,
    origenSaldoId: CFG_OS_INTERNO,
  });
  bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

  if (salSnap.exists) {
    await salRef.set(
      {
        [`bolsas.${bolsaId}`]: bolsa,
        "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    await salRef.set({
      persona_id: personaId,
      anio_calendario: anioOrigen,
      bolsas: { [bolsaId]: bolsa },
      metadata: { ultima_sincronizacion: FieldValue.serverTimestamp() },
    });
  }

  return {
    ok: true,
    persona_id: personaId,
    articulo_id: articuloId,
    anio_origen: anioOrigen,
    version_id: versionId,
    bolsa_id: bolsaId,
    cantidad_inicial: cantidadInicial,
  };
});

module.exports = { acreditarLaoBolsaAgente };
