"use strict";

/**
 * Trigger: alta `solicitudes_articulo` en BORRADOR → re-valida motor LAO (Fase 5a) y actualiza estado.
 * Descuento atómico en `saldos_articulo_agente` cuando existe bolsa coincidente y cupo suficiente.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

const { db, FieldValue } = require("../modules/shared/context");
const { runLaoPreviewSimulacion } = require("../modules/shared/laoPreviewMotor");
const { gatherLaoAltaMotorContext } = require("../modules/shared/solicitudLaoAltaMotorContext");
const { assertVersionInvariantForBolsa } = require("../modules/shared/laoVersionResolver");
const {
  saldoAnualDocId,
  pickBolsaParaConsumo,
  assertFifoAnioOrigen,
  mergeBolsasFromSaldoDocs,
  evaluarSaldoBolsaParaPreview,
} = require("../modules/shared/laoSaldosBolsa");
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
} = require("../modules/shared/solicitudesArticuloEstados");

const COL_SALDOS = "saldos_articulo_agente";

/** Legado: cupo teórico del motor (matriz / proporcional), no el rango del wizard. */
function resolveDiasConsumoMotor(resultado) {
  if (!resultado || !resultado.eligible) return 0;
  if (resultado.camino === "stock") return Number(resultado.matriz?.dias_base) || 0;
  if (resultado.camino === "proporcional") return Number(resultado.proporcional?.dias_proporcionales_piso) || 0;
  return 0;
}

/**
 * Días a descontar: prioriza `dias_solicitados` / snapshot del wizard; si no, motor legado.
 * @param {Record<string, unknown>} solicitudData
 * @param {ReturnType<typeof runLaoPreviewSimulacion>} resultado
 */
function resolveDiasConsumoOperativo(solicitudData, resultado) {
  const fromDoc = Number(solicitudData.dias_solicitados);
  const snap =
    solicitudData.resumen_computo_snapshot && typeof solicitudData.resumen_computo_snapshot === "object"
      ? solicitudData.resumen_computo_snapshot
      : null;
  const snapDias = snap ? Number(snap.dias_consumo) : NaN;

  if (Number.isInteger(fromDoc) && fromDoc >= 1 && fromDoc <= 366) {
    if (Number.isInteger(snapDias) && snapDias >= 1 && fromDoc !== snapDias) {
      return {
        dias: 0,
        error: `dias_solicitados (${fromDoc}) no coincide con resumen_computo_snapshot (${snapDias}).`,
        usaRangoWizard: true,
      };
    }
    return { dias: fromDoc, error: null, usaRangoWizard: true };
  }

  if (Number.isInteger(snapDias) && snapDias >= 1) {
    return { dias: snapDias, error: null, usaRangoWizard: true };
  }

  return {
    dias: resolveDiasConsumoMotor(resultado),
    error: null,
    usaRangoWizard: false,
  };
}

const onSolicitudArticuloLaoMotorValidate = onDocumentCreated(
  { document: "solicitudes_articulo/{solId}", region: "southamerica-east1" },
  async (event) => {
    const solId = event.params.solId;
    const snap = event.data;
    if (!snap) return;

    const d = snap.data() || {};
    if (d.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

    const schemaVersion = Number(d.schema_version);
    const patronSaldo = String(d.patron_saldo || "").trim();
    if (schemaVersion === 2 || patronSaldo === "B") return;

    const personaId = typeof d.titular_persona_id === "string" ? d.titular_persona_id.trim() : "";
    const articuloId = typeof d.articulo_id === "string" ? d.articulo_id.trim() : "";
    const versionId =
      typeof d.version_aplicada === "string"
        ? d.version_aplicada.trim()
        : typeof d.version_aplicada_id === "string"
          ? d.version_aplicada_id.trim()
          : "";
    const fechaDesde = typeof d.fecha_desde === "string" ? d.fecha_desde.trim().slice(0, 10) : "";
    const anioOrigenBolsa = Number(d.anio_origen_bolsa);

    if (!/^per_/i.test(personaId) || !/^art_/i.test(articuloId) || !/^ver_/i.test(versionId) || !fechaDesde) {
      logger.warn("solicitud_lao_motor_skip_datos", { solId });
      return;
    }
    if (!Number.isInteger(anioOrigenBolsa) || anioOrigenBolsa < 1900) {
      logger.warn("solicitud_lao_motor_skip_anio", { solId });
      return;
    }

    const solRef = db.collection("solicitudes_articulo").doc(solId);

    let ctx;
    try {
      ctx = await gatherLaoAltaMotorContext(db, {
        personaId,
        articuloId,
        versionId,
        fechaDesde,
        excludeSolicitudDocId: solId,
      });
    } catch (err) {
      logger.error("solicitud_lao_motor_context_error", { solId, message: err instanceof Error ? err.message : String(err) });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_error_contexto: err instanceof Error ? err.message : String(err),
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    try {
      assertVersionInvariantForBolsa(ctx.versionData, anioOrigenBolsa);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    let saldosMerged;
    try {
      const salPersonaSnap = await db.collection(COL_SALDOS).where("persona_id", "==", personaId).get();
      saldosMerged = mergeBolsasFromSaldoDocs(salPersonaSnap.docs.map((doc) => doc.data() || {}));
      assertFifoAnioOrigen(saldosMerged, articuloId, anioOrigenBolsa);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    let resultado;
    try {
      resultado = runLaoPreviewSimulacion({
        fechaDesdeYmd: fechaDesde,
        anioOrigenBolsa,
        hlcArray: ctx.hlcArray,
        diasExternos: ctx.diasExternos,
        exclusionIntervals: ctx.exclusionIntervals,
        versionData: ctx.versionData,
        operadorCodigoPorId: ctx.operadorMap,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [msg],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    if (!resultado.eligible) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: resultado.motivos_ineligibilidad || [],
        motor_snapshot: { motor_version: resultado.motor_version, camino: resultado.camino },
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const consumoRes = resolveDiasConsumoOperativo(d, resultado);
    if (consumoRes.error) {
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: [consumoRes.error],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      return;
    }

    const diasConsumo = consumoRes.dias;

    if (consumoRes.usaRangoWizard && diasConsumo > 0) {
      const saldoVal = evaluarSaldoBolsaParaPreview({
        saldosMerged,
        articuloId,
        anioOrigenBolsa,
        diasSolicitados: diasConsumo,
        fechaDesdeYmd: fechaDesde,
        diasProporcionalesPiso: resultado.proporcional?.dias_proporcionales_piso ?? null,
      });
      if (!saldoVal.ok) {
        await solRef.update({
          estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
          motor_motivos_ineligibilidad: saldoVal.motivos,
          motor_snapshot: {
            motor_version: resultado.motor_version,
            camino: saldoVal.camino || resultado.camino,
            dias_consumo: diasConsumo,
          },
          motor_validado_en: FieldValue.serverTimestamp(),
          actualizado_en: FieldValue.serverTimestamp(),
        });
        return;
      }
    }
    const anioSolicitud = resultado.anio_solicitud;
    const salId = saldoAnualDocId(personaId, anioOrigenBolsa);
    const salRef = salId ? db.collection(COL_SALDOS).doc(salId) : null;

    const motorOkPayload = {
      estado_solicitud_id: ESTADO_SOLICITUD_EN_REVISION_JEFE,
      motor_snapshot: {
        motor_version: resultado.motor_version,
        camino: resultado.camino,
        dias_consumo: diasConsumo,
        anio_solicitud: anioSolicitud,
      },
      motor_validado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    };

    if (diasConsumo <= 0 || !salRef) {
      await solRef.update({
        ...motorOkPayload,
        motor_descuento_aplicado: false,
        motor_descuento_motivo: diasConsumo <= 0 ? "dias_consumo_cero" : "saldo_doc_id_invalido",
      });
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        const sSnap = await tx.get(solRef);
        if (!sSnap.exists) return;
        const cur = sSnap.data() || {};
        if (cur.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

        const salSnap = await tx.get(salRef);
        if (!salSnap.exists) {
          tx.update(solRef, {
            ...motorOkPayload,
            motor_descuento_aplicado: false,
            motor_descuento_motivo: "sin_documento_saldo_anual",
          });
          return;
        }

        const salData = salSnap.data() || {};
        const match = pickBolsaParaConsumo(salData, articuloId, anioOrigenBolsa);
        if (!match) {
          tx.update(solRef, {
            ...motorOkPayload,
            motor_descuento_aplicado: false,
            motor_descuento_motivo: "sin_bolsa_coincidente",
          });
          return;
        }

        const disp = Number(match.bolsa.disponible);
        const cons = Number(match.bolsa.consumido) || 0;
        if (!Number.isFinite(disp) || disp < diasConsumo) {
          tx.update(solRef, {
            estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
            motor_motivos_ineligibilidad: [
              `Saldo insuficiente en bolsa (disponible ${Number.isFinite(disp) ? disp : "n/d"}, requerido ${diasConsumo}).`,
            ],
            motor_validado_en: FieldValue.serverTimestamp(),
            actualizado_en: FieldValue.serverTimestamp(),
          });
          return;
        }

        const newConsumido = cons + diasConsumo;
        const newDisponible = disp - diasConsumo;

        tx.update(salRef, {
          [`bolsas.${match.bolsaId}.consumido`]: newConsumido,
          [`bolsas.${match.bolsaId}.disponible`]: newDisponible,
          [`bolsas.${match.bolsaId}.ultima_actualizacion`]: FieldValue.serverTimestamp(),
          "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
        });

        tx.update(solRef, {
          ...motorOkPayload,
          motor_descuento_aplicado: true,
          motor_bolsa_id: match.bolsaId,
          motor_dias_descontados: diasConsumo,
        });
      });
    } catch (err) {
      logger.error("solicitud_lao_motor_tx_error", { solId, message: err instanceof Error ? err.message : String(err) });
      await solRef.update({
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        motor_motivos_ineligibilidad: ["Error al aplicar descuento de saldo; reintentá o contactá a RRHH."],
        motor_validado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
    }
  },
);

module.exports = {
  onSolicitudArticuloLaoMotorValidate,
  resolveDiasConsumoMotor,
  resolveDiasConsumoOperativo,
};
