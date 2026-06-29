"use strict";

const { db } = require("./context");
const {
  buscarConflictoSolapamientoSolicitudes,
  resolverRangoYmdSolicitudArticulo,
} = require("./avisoMedicoExclusividadPeriodoCore");
const { iterarYmdInclusive, buildAsiDocumentId } = require("./mdcRdaDocumentIds");
const { COL_ASISTENCIA_DIARIA } = require("./mdcComandosConstants");
const {
  MAX_AVISOS_PROVISORIOS_VIGENTES,
  listarAvisosIncompletosVigentes,
} = require("./avisoMedicoProvisoriosVigentesCore");

/**
 * Cada día del rango debe quedar libre de otras solicitudes activas y aportes en asistencia_diaria.
 *
 * @param {import("firebase-admin/firestore").Firestore} firestore
 * @param {{
 *   titularPersonaId: string,
 *   fechaDesde: string,
 *   fechaHasta?: string,
 *   excludeSolicitudId?: string,
 *   esAltaLicenciaIncompleta?: boolean,
 * }} input
 */
async function validarPeriodoExclusivoAvisoMedico(firestore, input) {
  const titular = String(input.titularPersonaId || "").trim();
  const desde = String(input.fechaDesde || "").slice(0, 10);
  const hasta = String(input.fechaHasta || input.fechaDesde || "").slice(0, 10);
  const exclude = String(input.excludeSolicitudId || "").trim();

  if (!/^per_/i.test(titular)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "Titular inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return { ok: false, codigo: "FECHA_DESDE_INVALIDA", mensaje: "Fecha de inicio inválida." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) {
    return {
      ok: false,
      codigo: "FECHA_HASTA_INVALIDA",
      mensaje: "La fecha de fin debe ser igual o posterior al inicio del reposo.",
    };
  }

  if (input.esAltaLicenciaIncompleta === true) {
    const vigentes = await listarAvisosIncompletosVigentes(firestore, titular);
    if (vigentes.length >= MAX_AVISOS_PROVISORIOS_VIGENTES) {
      return {
        ok: false,
        codigo: "MAX_AVISOS_PROVISORIOS_VIGENTES",
        mensaje: `Ya tenés ${MAX_AVISOS_PROVISORIOS_VIGENTES} avisos provisorios vigentes. Completá uno antes de registrar otro.`,
      };
    }
  }

  const snap = await firestore.collection("solicitudes_articulo").where("titular_persona_id", "==", titular).get();
  const rows = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const conflicto = buscarConflictoSolapamientoSolicitudes(desde, hasta, rows, exclude);
  if (conflicto) {
    return {
      ok: false,
      codigo: "PERIODO_SOLAPADO_SOLICITUD",
      mensaje:
        "Hay otra licencia o artículo que ocupa al menos un día de este período. Elegí fechas sin trámites superpuestos.",
      ...conflicto,
    };
  }

  const dias = iterarYmdInclusive(desde, hasta);
  for (const ymd of dias) {
    const asiId = buildAsiDocumentId(titular, ymd);
    if (!asiId) continue;
    const asiSnap = await firestore.collection(COL_ASISTENCIA_DIARIA).doc(asiId).get();
    if (!asiSnap.exists) continue;
    const aportes = asiSnap.data()?.aportes_normativos;
    if (!aportes || typeof aportes !== "object") continue;
    for (const solKey of Object.keys(aportes)) {
      if (exclude && solKey === exclude) continue;
      return {
        ok: false,
        codigo: "PERIODO_SOLAPADO_ASISTENCIA",
        mensaje:
          "Ya hay un artículo o licencia registrado en asistencia para al menos un día de este período.",
        conflicto_solicitud_id: solKey,
        conflicto_fecha: ymd,
      };
    }
  }

  return { ok: true };
}

module.exports = {
  validarPeriodoExclusivoAvisoMedico,
  resolverRangoYmdSolicitudArticulo,
};
