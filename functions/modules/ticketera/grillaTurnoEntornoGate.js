"use strict";

const { buildAsiDocumentId, iterarYmdInclusive } = require("../shared/mdcRdaDocumentIds");
const { COL_ASISTENCIA_DIARIA } = require("../shared/mdcComandosConstants");

const COL_PLAN_ROTATIVA = "planificacion_mensual_rotativa";
const COL_PLANES_TURNO = "planes_turno_servicio";
const PLAN_ESTADO_AUTORIZADO = "AUTORIZADO";
const PLAN_ESTADO_HABILITADO = "HABILITADO";

const CODIGO_GRILLA_NO_AUTORIZADA = "GRILLA_NO_AUTORIZADA";
const CODIGO_TURNO_NO_PLANIFICADO = "TURNO_NO_PLANIFICADO";

const MSG_GRILLA_BLOQUEADA =
  "Acción bloqueada: su servicio no registra una grilla horaria aprobada por la dirección para el período solicitado. Contacte a su jefatura.";

const MSG_TURNO_NO_PLANIFICADO =
  "No hay turno planificado en la grilla para la fecha solicitada. Contacte a su jefatura para regularizar la planificación.";

/**
 * @param {unknown} capa
 */
function capaTeoricaPresente(capa) {
  return Boolean(
    capa &&
      typeof capa === "object" &&
      (capa.tipo_dia || capa.tipo_id || capa.tipo || capa.ingreso_teorico || capa.egreso_teorico || capa.ingreso || capa.origen),
  );
}

/**
 * Grilla RDA + turno (capa teórica / plan autorizado) — Paso 2 entorno.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   depende_rda?: boolean,
 *   persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta?: string,
 *   grupo_trabajo_id?: string,
 * }} input
 */
async function evaluarGrillaTurnoEntorno(db, input) {
  if (input?.depende_rda !== true) {
    return {
      ok: true,
      codigo: null,
      mensaje: null,
      checks: { grilla_rda: true, turno: null },
    };
  }

  const personaId = String(input.persona_id || "").trim();
  const desde = String(input.fecha_desde || "").slice(0, 10);
  const hasta = String(input.fecha_hasta || desde).slice(0, 10);
  const gdtId = String(input.grupo_trabajo_id || "").trim();

  if (gdtId) {
    const periodo = desde.slice(0, 7);
    const v2Snap = await db.collection(COL_PLANES_TURNO)
      .where("grupo_id", "==", gdtId)
      .where("estado", "==", PLAN_ESTADO_HABILITADO)
      .get();
    const v2Match = v2Snap.docs.find((d) => {
      const data = d.data();
      if (data.tipo_plan === "mensual") return data.periodo === periodo;
      if (data.tipo_plan === "perpetuo") {
        const vDesde = data.vigente_desde || "";
        const vHasta = data.vigente_hasta || "9999-12-31";
        return desde >= vDesde && desde <= vHasta;
      }
      return false;
    });
    if (v2Match) {
      return { ok: true, codigo: null, mensaje: null, checks: { grilla_rda: true, turno: true } };
    }

    const periodoKey = desde.slice(0, 7).replace("-", "_");
    const planId = `${gdtId}_${periodoKey}`;
    const planSnap = await db.collection(COL_PLAN_ROTATIVA).doc(planId).get();
    if (planSnap.exists) {
      const estado = String(planSnap.data()?.estado_plan || planSnap.data()?.estado || "").trim();
      if (estado && estado !== PLAN_ESTADO_AUTORIZADO) {
        return {
          ok: false,
          codigo: CODIGO_GRILLA_NO_AUTORIZADA,
          mensaje: MSG_GRILLA_BLOQUEADA,
          checks: { grilla_rda: false, turno: false },
        };
      }
      return {
        ok: true,
        codigo: null,
        mensaje: null,
        checks: { grilla_rda: true, turno: true },
      };
    }
  }

  const dias = iterarYmdInclusive(desde, hasta);
  for (const ymd of dias) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    if (!asiId) continue;
    const snap = await db.collection(COL_ASISTENCIA_DIARIA).doc(asiId).get();
    const capa = snap.exists ? snap.data()?.capa_teorica : null;
    if (!capaTeoricaPresente(capa)) {
      return {
        ok: false,
        codigo: CODIGO_TURNO_NO_PLANIFICADO,
        mensaje: MSG_TURNO_NO_PLANIFICADO,
        checks: { grilla_rda: false, turno: false },
      };
    }
  }

  return {
    ok: true,
    codigo: null,
    mensaje: null,
    checks: { grilla_rda: true, turno: true },
  };
}

module.exports = {
  evaluarGrillaTurnoEntorno,
  CODIGO_GRILLA_NO_AUTORIZADA,
  CODIGO_TURNO_NO_PLANIFICADO,
  MSG_GRILLA_BLOQUEADA,
  MSG_TURNO_NO_PLANIFICADO,
  COL_PLAN_ROTATIVA,
  PLAN_ESTADO_AUTORIZADO,
};
