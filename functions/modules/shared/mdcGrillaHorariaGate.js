"use strict";

const {
  evaluarGrillaTurnoEntorno,
  CODIGO_GRILLA_NO_AUTORIZADA,
  CODIGO_TURNO_NO_PLANIFICADO,
  MSG_GRILLA_BLOQUEADA,
  MSG_TURNO_NO_PLANIFICADO,
  COL_PLAN_ROTATIVA,
  PLAN_ESTADO_AUTORIZADO,
} = require("../ticketera/grillaTurnoEntornoGate");

/**
 * Gate motor/trigger (Patrón B): misma regla que Paso 2; códigos unificados para rechazo.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ depende_rda?: boolean, persona_id: string, fecha_desde: string, fecha_hasta?: string, grupo_trabajo_id?: string }} input
 */
async function validarGrillaHorariaParaSolicitud(db, input) {
  const r = await evaluarGrillaTurnoEntorno(db, input);
  if (r.ok) return { ok: true };
  const codigo =
    r.codigo === CODIGO_TURNO_NO_PLANIFICADO ? CODIGO_GRILLA_NO_AUTORIZADA : r.codigo || CODIGO_GRILLA_NO_AUTORIZADA;
  const mensaje =
    r.codigo === CODIGO_TURNO_NO_PLANIFICADO ? MSG_TURNO_NO_PLANIFICADO : r.mensaje || MSG_GRILLA_BLOQUEADA;
  return { ok: false, codigo, httpStatus: 403, mensaje };
}

module.exports = {
  validarGrillaHorariaParaSolicitud,
  COL_PLAN_ROTATIVA,
  PLAN_ESTADO_AUTORIZADO,
  MSG_GRILLA_BLOQUEADA,
};
