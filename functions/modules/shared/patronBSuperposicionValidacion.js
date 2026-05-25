"use strict";

const { CODIGO_SUPERPOSICION, mensajeParaCodigo } = require("./solicitudElegibilidadLaboral");
const { iterarYmdInclusive, buildAsiDocumentId } = require("./mdcRdaDocumentIds");
const { COL_ASISTENCIA_DIARIA } = require("./mdcComandosConstants");
const {
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_RECHAZADA,
} = require("./solicitudesArticuloEstados");

const CFG_POLITICA_SUPERPOSICION_BLOQUEANTE = "cfg_ps_bloqueante";

const ESTADOS_SOLICITUD_OCUPAN_FECHA = new Set([
  ESTADO_SOLICITUD_BORRADOR,
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
]);

/**
 * @param {string} d1
 * @param {string} h1
 * @param {string} d2
 * @param {string} h2
 */
function rangosYmdSeSolapan(d1, h1, d2, h2) {
  const a = String(d1 || "").slice(0, 10);
  const b = String(h1 || d1 || "").slice(0, 10);
  const c = String(d2 || "").slice(0, 10);
  const d = String(h2 || d2 || "").slice(0, 10);
  if (!a || !c) return false;
  return a <= d && c <= b;
}

/**
 * Política BLOQUEANTE (`cfg_ps_bloqueante`): rechaza alta si otra solicitud activa
 * o un aporte en `asistencia_diaria` ya ocupa algún día del rango.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   fecha_desde: string,
 *   fecha_hasta?: string,
 *   exclude_sol_id?: string,
 *   version_data: Record<string, unknown> | null | undefined,
 * }} input
 */
async function validarSuperposicionFechasPatronB(db, input) {
  const topes =
    input?.version_data && typeof input.version_data === "object"
      ? input.version_data.bloque_topes_plazos_computo || {}
      : {};
  const politicaId = String(topes.politica_superposicion_id || "").trim();
  if (politicaId !== CFG_POLITICA_SUPERPOSICION_BLOQUEANTE) {
    return { ok: true };
  }

  const personaId = String(input.persona_id || "").trim();
  const desde = String(input.fecha_desde || "").slice(0, 10);
  const hasta = String(input.fecha_hasta || input.fecha_desde || "").slice(0, 10);
  const excludeSolId = String(input.exclude_sol_id || "").trim();
  if (!personaId || !desde) {
    return { ok: true };
  }

  const diasPedido = iterarYmdInclusive(desde, hasta);
  if (!diasPedido.length) {
    return { ok: true };
  }

  const snap = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", personaId)
    .get();

  for (const doc of snap.docs) {
    if (excludeSolId && doc.id === excludeSolId) continue;
    const s = doc.data() || {};
    const estado = String(s.estado_solicitud_id || "").trim();
    if (estado === ESTADO_SOLICITUD_RECHAZADA || !ESTADOS_SOLICITUD_OCUPAN_FECHA.has(estado)) {
      continue;
    }
    const fd = String(s.fecha_desde || "").slice(0, 10);
    const fh = String(s.fecha_hasta || s.fecha_desde || "").slice(0, 10);
    if (rangosYmdSeSolapan(desde, hasta, fd, fh)) {
      return {
        ok: false,
        codigo: CODIGO_SUPERPOSICION,
        mensaje: mensajeParaCodigo(CODIGO_SUPERPOSICION),
        conflicto_solicitud_id: doc.id,
        conflicto_estado_solicitud_id: estado,
      };
    }
  }

  for (const ymd of diasPedido) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    if (!asiId) continue;
    const asiSnap = await db.collection(COL_ASISTENCIA_DIARIA).doc(asiId).get();
    if (!asiSnap.exists) continue;
    const aportes = asiSnap.data()?.aportes_normativos;
    if (!aportes || typeof aportes !== "object") continue;
    for (const solKey of Object.keys(aportes)) {
      if (excludeSolId && solKey === excludeSolId) continue;
      return {
        ok: false,
        codigo: CODIGO_SUPERPOSICION,
        mensaje: mensajeParaCodigo(CODIGO_SUPERPOSICION),
        conflicto_solicitud_id: solKey,
        conflicto_fuente: "asistencia_diaria",
      };
    }
  }

  return { ok: true };
}

module.exports = {
  validarSuperposicionFechasPatronB,
  CFG_POLITICA_SUPERPOSICION_BLOQUEANTE,
  ESTADOS_SOLICITUD_OCUPAN_FECHA,
  rangosYmdSeSolapan,
};
