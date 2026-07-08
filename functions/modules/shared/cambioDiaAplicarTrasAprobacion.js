"use strict";

/**
 * Aplica traslado propio B-BATCH tras aprobación jefe de solicitud CAMBIO-DIA.
 * Si falla → deja cfg_esa_aprobada_pendiente_aplicacion (remediación RRHH).
 */

const { logger } = require("firebase-functions");
const { FieldValue } = require("./context");
const { buildAsiDocumentId, buildVisDocumentId } = require("./mdcRdaDocumentIds");
const { resolverCapaTeoricaGrupo } = require("./capaTeoricaPorGrupoCore");
const {
  ESTADO_SOLICITUD_APROBADA,
  ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
} = require("./solicitudesArticuloEstados");
const { solicitudEsCambioDia } = require("./cambioDiaSolicitudCore");
const { aplicarBatchAsistenciaCore } = require("../asistencia/cambiosTurno");

const COL_ASISTENCIA = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId
 */
async function leerCapaYToken(db, personaId, fechaYmd, grupoTrabajoId) {
  const asiId = buildAsiDocumentId(personaId, fechaYmd);
  const visId = buildVisDocumentId(personaId, fechaYmd, grupoTrabajoId);
  const [asiSnap, visSnap] = await Promise.all([
    db.collection(COL_ASISTENCIA).doc(asiId).get(),
    db.collection(COL_VIS).doc(visId).get(),
  ]);
  const asiData = asiSnap.exists ? asiSnap.data() : null;
  const capa = resolverCapaTeoricaGrupo(asiData, grupoTrabajoId);
  const versionToken =
    tsToIso(visSnap?.data()?.metadata?.version_token) ||
    tsToIso(visSnap?.data()?.metadata?.ultima_sync_teorica) ||
    "";
  const segs = Array.isArray(capa?.segmentos)
    ? [
        ...new Set(
          capa.segmentos
            .map((s) => String(s?.segmento_id || "").trim())
            .filter(Boolean),
        ),
      ]
    : [];
  return { capa, segs, versionToken, visId, asiId };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   solId: string,
 *   sol: Record<string, unknown>,
 *   revisorPersonaId: string,
 * }} params
 */
async function aplicarCambioDiaTrasAprobacionJefe(db, params) {
  const solId = String(params.solId || "").trim();
  const sol = params.sol && typeof params.sol === "object" ? params.sol : {};
  const revisorPersonaId = String(params.revisorPersonaId || "").trim();

  if (!solicitudEsCambioDia(sol)) {
    return { applied: false, skipped: true };
  }

  const personaId = String(sol.titular_persona_id || "").trim();
  const gdt = String(sol.grupo_trabajo_id_ancla || "").trim();
  const fechaOrigen = String(sol.fecha_origen || sol.fecha_desde || "").trim().slice(0, 10);
  const fechaDestino = String(sol.fecha_destino || "").trim().slice(0, 10);
  const motivo = String(sol.motivo || sol.jefe_motivo || "Cambio de día").trim();

  const solRef = db.collection("solicitudes_articulo").doc(solId);

  const failPendiente = async (codigo, mensaje, detail = {}) => {
    logger.warn("cambio_dia_bbatch_pendiente", { solId, codigo, mensaje, ...detail });
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
      cambio_dia_aplicacion_error: {
        codigo,
        mensaje,
        en: FieldValue.serverTimestamp(),
        detalle: detail,
      },
      actualizado_en: FieldValue.serverTimestamp(),
    });
    return {
      applied: false,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA_PENDIENTE_APLICACION,
      codigo,
      mensaje,
    };
  };

  if (!/^per_/i.test(personaId) || !/^gdt_/i.test(gdt)) {
    return failPendiente("CAMBIO_DIA_CTX", "Falta titular o grupo ancla para aplicar el traslado.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaOrigen) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDestino)) {
    return failPendiente("CAMBIO_DIA_FECHAS", "fecha_origen / fecha_destino inválidas en la solicitud.");
  }
  if (fechaOrigen.slice(0, 7) !== fechaDestino.slice(0, 7)) {
    return failPendiente(
      "CAMBIO_DIA_PERIODO",
      "Origen y destino deben estar en el mismo mes para B-BATCH (remediación RRHH).",
      { fechaOrigen, fechaDestino },
    );
  }
  if (motivo.length < 3) {
    return failPendiente("CAMBIO_DIA_MOTIVO", "Motivo insuficiente para B-BATCH.");
  }

  let origen;
  let destino;
  try {
    [origen, destino] = await Promise.all([
      leerCapaYToken(db, personaId, fechaOrigen, gdt),
      leerCapaYToken(db, personaId, fechaDestino, gdt),
    ]);
  } catch (e) {
    return failPendiente("CAMBIO_DIA_CAPA_READ", e instanceof Error ? e.message : String(e));
  }

  if (!origen.segs.length) {
    return failPendiente(
      "CAMBIO_DIA_SIN_SEGMENTOS_ORIGEN",
      "El día origen no tiene turnos materializados para trasladar.",
      { fechaOrigen },
    );
  }
  if (!origen.versionToken || !destino.versionToken) {
    return failPendiente(
      "CAMBIO_DIA_SIN_TOKEN",
      "Faltan tokens de concurrencia en la grilla (vis_*).",
      { origen: Boolean(origen.versionToken), destino: Boolean(destino.versionToken) },
    );
  }

  const segs = origen.segs;
  const turnoDestino = segs[0];
  const periodo = fechaOrigen.slice(0, 7);
  const op = {
    id: `op_cambio_dia_${solId}`,
    tipo: "reemplazo",
    creado_en: new Date().toISOString(),
    concurrencia: {
      expected_version_token: destino.versionToken,
      expected_version_token_origen: origen.versionToken,
    },
    context: { grupo_id: gdt, periodo },
    payload: {
      persona_id: personaId,
      fecha: fechaDestino,
      fecha_origen: fechaOrigen,
      fecha_destino: fechaDestino,
      segmentos_a_trasladar: segs,
      segmentos_incorporados_destino: [...segs],
      turno_id: turnoDestino,
      turno_id_destino: turnoDestino,
      franco_en_origen: true,
      tipo: "reemplazo",
      motivo: motivo.slice(0, 500),
      es_urgencia_operativa: false,
      solicitud_articulo_id: solId,
    },
  };

  try {
    const batchRes = await aplicarBatchAsistenciaCore({
      data: { ops: [op], periodo },
      auth: {
        uid: revisorPersonaId || "system_cambio_dia",
        token: { persona_id: revisorPersonaId },
      },
      skipAuthAssert: true,
    });
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      cambio_dia_aplicacion_ok: true,
      cambio_dia_aplicacion_en: FieldValue.serverTimestamp(),
      cambio_dia_batch: {
        aplicadas: batchRes?.aplicadas ?? null,
        periodo: batchRes?.periodo || periodo,
        segmentos: segs,
      },
      cambio_dia_aplicacion_error: FieldValue.delete(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
    return {
      applied: true,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      batch: batchRes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e && e.code ? String(e.code) : "CAMBIO_DIA_BBATCH_FAIL";
    return failPendiente(code, msg, { op_id: op.id });
  }
}

module.exports = {
  aplicarCambioDiaTrasAprobacionJefe,
  leerCapaYToken,
};
