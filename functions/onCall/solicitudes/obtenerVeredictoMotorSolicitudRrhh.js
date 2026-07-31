"use strict";

/**
 * Veredicto congelado del motor LAO de un trámite, para la bandeja RRHH.
 *
 * El snapshot es el objeto más pesado del documento y casi nunca se mira, así
 * que salió del listado: se pide de a uno cuando RRHH despliega el bloque. Es
 * de solo lectura y no recalcula nada — el snapshot es inmutable desde el alta.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../../modules/shared/context");
const { tokenHasRrhhLaborAccess } = require("../../modules/shared/laborProfile");

const COL_SOL = "solicitudes_articulo";

const obtenerVeredictoMotorSolicitudRrhhCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  if (!tokenHasRrhhLaborAccess(request.auth.token || {})) {
    throw new HttpsError("permission-denied", "Solo RRHH puede acceder a esta bandeja.");
  }

  const d = request.data && typeof request.data === "object" ? request.data : {};
  const solicitudId = typeof d.solicitud_id === "string" ? d.solicitud_id.trim() : "";
  if (!/^sol_/i.test(solicitudId)) {
    throw new HttpsError("invalid-argument", "solicitud_id inválido.");
  }

  const snap = await db.collection(COL_SOL).doc(solicitudId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "La solicitud no existe.");
  }
  const sol = snap.data() || {};

  return {
    solicitud_id: solicitudId,
    motor_snapshot:
      sol.motor_snapshot && typeof sol.motor_snapshot === "object" ? sol.motor_snapshot : null,
    motor_validado_en: sol.motor_validado_en || null,
  };
});

module.exports = {
  obtenerVeredictoMotorSolicitudRrhh: obtenerVeredictoMotorSolicitudRrhhCallable,
};
