"use strict";

const { logger } = require("firebase-functions");
const {
  MDC_COMANDO_PROYECTAR_PENDIENTE,
  MDC_COMANDO_REVERTIR_PROYECCION,
  MDC_COMANDO_VERSION,
  COL_MDC_IDEMPOTENCIA,
} = require("./mdcComandosConstants");
const {
  encolarComandoMdcTicketera,
  buildMdcPayloadDesdeSolicitud,
} = require("./mdcTicketeraEmisor");
const { ESTADO_PENDIENTE_CLASIFICACION } = require("./avisoMedicoProvisoriosVigentesCore");
const {
  listarGruposTrabajoVigentesEnFecha,
  buildGruposTrabajoInvolucradosIdsFromVigentes,
} = require("./solicitudGrupoTrabajoAncla");
const {
  esSolicitudMedAviso,
  mapSolicitudMedAvisoParaMdc,
  NIVEL_OCUPACION_AVISO_MEDICO,
  resolverRangoYmdAvisoMedico,
} = require("./avisoMedicoGrillaMdcPayload");

/**
 * @param {string} solId
 * @param {string} comando
 */
function idempotenciaDocId(solId, comando) {
  return `${String(solId).trim()}_${String(comando).trim()}_v${MDC_COMANDO_VERSION}`;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} comando
 */
async function limpiarIdempotenciaMdc(db, solId, comando) {
  const id = idempotenciaDocId(solId, comando);
  await db.collection(COL_MDC_IDEMPOTENCIA).doc(id).delete().catch(() => {});
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Record<string, unknown>} d
 * @param {string} solId
 */
async function enriquecerGruposTrabajoAvisoMedico(db, d, solId) {
  const rango = resolverRangoYmdAvisoMedico(d);
  if (!rango) return d;
  const titular = String(d.titular_persona_id || "").trim();
  const prev = Array.isArray(d.grupos_trabajo_involucrados_ids) ? d.grupos_trabajo_involucrados_ids : [];
  if (prev.length > 0) return d;

  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, titular, rango.fecha_desde);
  const gruposTrabajoInvolucradosIds = buildGruposTrabajoInvolucradosIdsFromVigentes(vigentes);
  if (!gruposTrabajoInvolucradosIds.length) return d;

  return { ...d, id: solId, grupos_trabajo_involucrados_ids: gruposTrabajoInvolucradosIds };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {Record<string, unknown>} solData
 */
async function proyectarAvisoMedicoEnGrilla(db, solId, solData) {
  const base = solData || {};
  if (!esSolicitudMedAviso(base)) return { ok: false, codigo: "NO_MED_AVISO" };
  if (String(base.estado_solicitud_id || "") !== ESTADO_PENDIENTE_CLASIFICACION) {
    return { ok: false, codigo: "ESTADO_NO_PROYECTABLE" };
  }

  const enriched = await enriquecerGruposTrabajoAvisoMedico(db, base, solId);
  const mapped = mapSolicitudMedAvisoParaMdc(enriched, solId);
  if (!mapped) return { ok: false, codigo: "RANGO_FECHAS_INVALIDO" };

  const payload = buildMdcPayloadDesdeSolicitud(mapped, MDC_COMANDO_PROYECTAR_PENDIENTE);
  payload.nivel_ocupacion_dia_id = NIVEL_OCUPACION_AVISO_MEDICO;
  return encolarComandoMdcTicketera(db, payload);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {{ fechaDesdeAnterior?: string, fechaHastaAnterior?: string }} [opts]
 */
async function resincronizarProyeccionAvisoMedicoGrilla(db, solId, opts = {}) {
  const ref = db.collection("solicitudes_articulo").doc(solId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, codigo: "NO_ENCONTRADA" };
  const d = { id: snap.id, ...(snap.data() || {}) };

  const desdeAnt = String(opts.fechaDesdeAnterior || "").slice(0, 10);
  const hastaAnt = String(opts.fechaHastaAnterior || desdeAnt || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(desdeAnt)) {
    const mappedActual = mapSolicitudMedAvisoParaMdc(d, solId);
    const revertPayload = buildMdcPayloadDesdeSolicitud(
      {
        ...(mappedActual || d),
        id: solId,
        fecha_desde: desdeAnt,
        fecha_hasta: hastaAnt,
        estado_solicitud_id: ESTADO_PENDIENTE_CLASIFICACION,
      },
      MDC_COMANDO_REVERTIR_PROYECCION,
    );
    await limpiarIdempotenciaMdc(db, solId, MDC_COMANDO_REVERTIR_PROYECCION);
    await encolarComandoMdcTicketera(db, revertPayload);
  }

  await limpiarIdempotenciaMdc(db, solId, MDC_COMANDO_PROYECTAR_PENDIENTE);
  return proyectarAvisoMedicoEnGrilla(db, solId, d);
}

function proyectarAvisoMedicoEnGrillaAsync(db, solId, solData) {
  void proyectarAvisoMedicoEnGrilla(db, solId, solData).catch((err) => {
    logger.warn("aviso_medico_grilla_mdc_error", {
      solId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

function resincronizarProyeccionAvisoMedicoGrillaAsync(db, solId, opts) {
  void resincronizarProyeccionAvisoMedicoGrilla(db, solId, opts).catch((err) => {
    logger.warn("aviso_medico_grilla_resync_error", {
      solId,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

module.exports = {
  limpiarIdempotenciaMdc,
  enriquecerGruposTrabajoAvisoMedico,
  proyectarAvisoMedicoEnGrilla,
  proyectarAvisoMedicoEnGrillaAsync,
  resincronizarProyeccionAvisoMedicoGrilla,
  resincronizarProyeccionAvisoMedicoGrillaAsync,
};
