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
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
} = require("../modules/shared/solicitudesArticuloEstados");

const COL_SALDOS = "saldos_articulo_agente";

function saldoAnualDocId(personaId, anioCalendario) {
  const m = /^per_([0-9A-HJKMNP-TV-Z]{26})$/i.exec(String(personaId || "").trim());
  if (!m) return null;
  const y = Number(anioCalendario);
  if (!Number.isInteger(y) || y < 1900 || y > 2200) return null;
  return `sal_${y}_per_${m[1]}`;
}

function resolveDiasConsumo(resultado) {
  if (!resultado || !resultado.eligible) return 0;
  if (resultado.camino === "stock") return Number(resultado.matriz?.dias_base) || 0;
  if (resultado.camino === "proporcional") return Number(resultado.proporcional?.dias_proporcionales_piso) || 0;
  return 0;
}

function pickBolsaParaConsumo(saldosData, articuloId, anioOrigenBolsa) {
  const bolsas = saldosData && typeof saldosData.bolsas === "object" ? saldosData.bolsas : {};
  const art = String(articuloId || "").trim();
  const anio = Number(anioOrigenBolsa);
  for (const [bolsaId, b] of Object.entries(bolsas)) {
    if (!b || typeof b !== "object") continue;
    if (String(b.articulo_id || "").trim() !== art) continue;
    if (Number(b.anio_origen) !== anio) continue;
    return { bolsaId, bolsa: b };
  }
  return null;
}

const onSolicitudArticuloLaoMotorValidate = onDocumentCreated(
  { document: "solicitudes_articulo/{solId}", region: "southamerica-east1" },
  async (event) => {
    const solId = event.params.solId;
    const snap = event.data;
    if (!snap) return;

    const d = snap.data() || {};
    if (d.estado_solicitud_id !== ESTADO_SOLICITUD_BORRADOR) return;

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

    const diasConsumo = resolveDiasConsumo(resultado);
    const anioSolicitud = resultado.anio_solicitud;
    const salId = saldoAnualDocId(personaId, anioSolicitud);
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

module.exports = { onSolicitudArticuloLaoMotorValidate };
