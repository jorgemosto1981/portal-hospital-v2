"use strict";

const { buildAsiDocumentId, iterarYmdInclusive } = require("./mdcRdaDocumentIds");
const { COL_ASISTENCIA_DIARIA } = require("./mdcComandosConstants");

const COL_PLAN_ROTATIVA = "planificacion_mensual_rotativa";
const PLAN_ESTADO_AUTORIZADO = "AUTORIZADO";

const MSG_GRILLA_BLOQUEADA =
  "Acción bloqueada: su servicio no registra una grilla horaria aprobada por la dirección para el período solicitado. Contacte a su jefatura.";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ depende_rda?: boolean, persona_id: string, fecha_desde: string, fecha_hasta?: string, grupo_trabajo_id?: string }} input
 */
async function validarGrillaHorariaParaSolicitud(db, input) {
  if (input?.depende_rda !== true) return { ok: true };

  const personaId = String(input.persona_id || "").trim();
  const desde = String(input.fecha_desde || "").slice(0, 10);
  const hasta = String(input.fecha_hasta || desde).slice(0, 10);
  const gdtId = String(input.grupo_trabajo_id || "").trim();

  if (gdtId) {
    const periodoKey = desde.slice(0, 7).replace("-", "_");
    const planId = `${gdtId}_${periodoKey}`;
    const planSnap = await db.collection(COL_PLAN_ROTATIVA).doc(planId).get();
    if (planSnap.exists) {
      const estado = String(planSnap.data()?.estado_plan || planSnap.data()?.estado || "").trim();
      if (estado && estado !== PLAN_ESTADO_AUTORIZADO) {
        return { ok: false, codigo: "GRILLA_NO_AUTORIZADA", httpStatus: 403, mensaje: MSG_GRILLA_BLOQUEADA };
      }
      return { ok: true };
    }
  }

  const dias = iterarYmdInclusive(desde, hasta);
  for (const ymd of dias) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    if (!asiId) continue;
    const snap = await db.collection(COL_ASISTENCIA_DIARIA).doc(asiId).get();
    const capa = snap.exists ? snap.data()?.capa_teorica : null;
    const okCapa =
      capa &&
      typeof capa === "object" &&
      (capa.tipo_id || capa.tipo || capa.ingreso_teorico || capa.egreso_teorico);
    if (!okCapa) {
      return { ok: false, codigo: "GRILLA_NO_AUTORIZADA", httpStatus: 403, mensaje: MSG_GRILLA_BLOQUEADA };
    }
  }

  return { ok: true };
}

module.exports = {
  validarGrillaHorariaParaSolicitud,
  COL_PLAN_ROTATIVA,
  PLAN_ESTADO_AUTORIZADO,
  MSG_GRILLA_BLOQUEADA,
};
