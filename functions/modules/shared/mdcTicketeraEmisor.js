"use strict";

const { logger } = require("firebase-functions");
const { FieldValue } = require("./context");
const {
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_AUTORIZAR_JEFE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcComandosConstants");
const { procesarComandoMdc, buildMdcPayloadDesdeSolicitud } = require("./mdcWorkerCore");

const COL_SOL = "solicitudes_articulo";

/**
 * Dispara MDC sin bloquear la transición humana (S2). Errores → log + flag en sol_*.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} payload
 */
async function encolarComandoMdcTicketera(db, payload) {
  try {
    const result = await procesarComandoMdc(db, payload);
    if (payload?.sol_id) {
      await db.collection(COL_SOL).doc(String(payload.sol_id)).set(
        {
          mdc_ultimo_comando: payload.comando || null,
          mdc_ultimo_procesado_en: FieldValue.serverTimestamp(),
          mdc_ultimo_resultado_ok: result.ok === true,
          mdc_ultimo_codigo: result.codigo || null,
        },
        { merge: true },
      );
    }

    if (!result.ok && payload?.sol_id) {
      await marcarConsolidacionPendiente(db, String(payload.sol_id), result.codigo);
    } else if (
      result.ok &&
      (payload.comando === MDC_COMANDO_CONSOLIDAR_APROBADO ||
        payload.comando === MDC_COMANDO_PROYECTAR_PENDIENTE) &&
      payload?.sol_id
    ) {
      await db
        .collection(COL_SOL)
        .doc(String(payload.sol_id))
        .set({ mdc_consolidacion_pendiente: false, mdc_ultimo_ok_en: FieldValue.serverTimestamp() }, { merge: true });
    }
    return result;
  } catch (err) {
    logger.error("mdc_ticketera_error", {
      sol_id: payload?.sol_id,
      comando: payload?.comando,
      message: err instanceof Error ? err.message : String(err),
    });
    if (payload?.sol_id) {
      await marcarConsolidacionPendiente(db, String(payload.sol_id), "MDC_ERROR");
    }
    return { ok: false, codigo: "MDC_ERROR" };
  }
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {Record<string, unknown>} solData
 * @param {string} comando
 */
function dispararMdcDesdeSolicitudAsync(db, solId, solData, comando) {
  const payload = buildMdcPayloadDesdeSolicitud({ ...solData, id: solId }, comando);
  void encolarComandoMdcTicketera(db, payload);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} codigo
 */
async function marcarConsolidacionPendiente(db, solId, codigo) {
  await db.collection(COL_SOL).doc(solId).set(
    {
      mdc_consolidacion_pendiente: true,
      mdc_ultimo_error_codigo: codigo || null,
      mdc_ultimo_error_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

module.exports = {
  encolarComandoMdcTicketera,
  dispararMdcDesdeSolicitudAsync,
  buildMdcPayloadDesdeSolicitud,
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_AUTORIZAR_JEFE,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
};
