"use strict";

const { FieldValue, Timestamp } = require("./context");
const {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
} = require("./avisoMedicoProvisoriosVigentesCore");
const { resolverRangoYmdAvisoMedico } = require("./avisoMedicoGrillaMdcPayload");
const { mutarEstadoSolicitudMedicaMdc } = require("./mutarEstadoSolicitudMedicaMdc");

const COL_SOL = "solicitudes_articulo";
const ESTADO_RECHAZADA = "cfg_esa_rechazada";
const MOTIVO_RECHAZO_VENCIMIENTO_INCOMPLETA = "cfg_mrs_doc_incompleta";
const MOTIVO_RECHAZO_DETALLE_DEFAULT =
  "Venció el plazo para presentar el certificado médico (aviso provisorio).";
const DEFAULT_BATCH_SIZE = 50;

/**
 * @param {Record<string, unknown>} d
 * @param {number} [nowMs]
 */
function esCandidatoVencimientoIncompleta(d, nowMs = Date.now()) {
  if (String(d.schema_version || "") !== SCHEMA_MED_AVISO) return false;
  if (String(d.estado_solicitud_id || "") !== ESTADO_PENDIENTE_CLASIFICACION) return false;
  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : null;
  if (!ing || ing.es_licencia_incompleta !== true) return false;
  const venc = d.vencimiento_plazo_certificado;
  const vencMs = venc && typeof venc.toDate === "function" ? venc.toDate().getTime() : NaN;
  return Number.isFinite(vencMs) && vencMs <= nowMs;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solicitudId
 * @param {{ motivoRechazoId?: string, motivoRechazoDetalle?: string }} [opts]
 */
async function invalidarVencimientoIncompletaEnTransaccion(db, solicitudId, opts = {}) {
  const solId = String(solicitudId || "").trim();
  if (!/^sol_/i.test(solId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", outcome: "error" };
  }

  const motivoId = String(opts.motivoRechazoId || MOTIVO_RECHAZO_VENCIMIENTO_INCOMPLETA).trim();
  const motivoDetalle = String(opts.motivoRechazoDetalle || MOTIVO_RECHAZO_DETALLE_DEFAULT).slice(0, 512);

  /** @type {{ outcome: string, codigo?: string, rangoProyeccionAnterior?: { fecha_desde: string, fecha_hasta: string }|null }} */
  const txResult = await db.runTransaction(async (tx) => {
    const ref = db.collection(COL_SOL).doc(solId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { outcome: "omitido", codigo: "NO_ENCONTRADA" };
    }
    const d = snap.data() || {};
    if (!esCandidatoVencimientoIncompleta(d)) {
      return { outcome: "omitido", codigo: "NO_CANDIDATO" };
    }

    const rangoProyeccionAnterior = resolverRangoYmdAvisoMedico(d);

    tx.update(ref, {
      estado_solicitud_id: ESTADO_RECHAZADA,
      motivo_rechazo_id: motivoId,
      motivo_rechazo_detalle: motivoDetalle,
      vencimiento_procesado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    });

    return { outcome: "procesado", rangoProyeccionAnterior };
  });

  if (txResult.outcome !== "procesado") {
    return {
      ok: true,
      solicitud_id: solId,
      outcome: txResult.outcome,
      codigo: txResult.codigo,
    };
  }

  const mdc = await mutarEstadoSolicitudMedicaMdc(db, {
    solicitudId: solId,
    estadoDestino: ESTADO_RECHAZADA,
    rangoProyeccionAnterior: txResult.rangoProyeccionAnterior || null,
  });

  if (mdc.ok !== true) {
    return {
      ok: false,
      solicitud_id: solId,
      outcome: "error",
      codigo: mdc.codigo || "MDC_MUTACION_FALLIDA",
      mdc_mutacion: mdc,
    };
  }

  return {
    ok: true,
    solicitud_id: solId,
    outcome: "procesado",
    estado_solicitud_id: ESTADO_RECHAZADA,
    mdc_mutacion: mdc,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   batchSize?: number,
 *   maxPaginas?: number,
 *   dryRun?: boolean,
 *   startAfterSnapshot?: import("firebase-admin/firestore").DocumentSnapshot | null,
 * }} [options]
 */
async function procesarVencimientosLicenciaIncompleta(db, options = {}) {
  const batchSize = Math.min(100, Math.max(1, Number(options.batchSize) || DEFAULT_BATCH_SIZE));
  const maxPaginas = Math.min(20, Math.max(1, Number(options.maxPaginas) || 5));
  const dryRun = options.dryRun === true;
  const now = Timestamp.now();

  /** @type {Array<Record<string, unknown>>} */
  const detalle = [];
  /** @type {Array<Record<string, unknown>>} */
  const errores = [];
  let procesados = 0;
  let omitidos = 0;
  let candidatosQuery = 0;
  /** @type {import("firebase-admin/firestore").DocumentSnapshot | null} */
  let cursor = options.startAfterSnapshot || null;
  let paginas = 0;
  let tieneMas = false;

  while (paginas < maxPaginas) {
    let query = db
      .collection(COL_SOL)
      .where("estado_solicitud_id", "==", ESTADO_PENDIENTE_CLASIFICACION)
      .where("vencimiento_plazo_certificado", "<", now)
      .orderBy("vencimiento_plazo_certificado", "asc")
      .limit(batchSize);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    paginas += 1;
    if (snap.empty) break;

    cursor = snap.docs[snap.docs.length - 1];
    tieneMas = snap.size >= batchSize;

    for (const doc of snap.docs) {
      const d = doc.data() || {};
      candidatosQuery += 1;
      if (!esCandidatoVencimientoIncompleta(d)) {
        omitidos += 1;
        detalle.push({ solicitud_id: doc.id, outcome: "omitido", codigo: "FILTRO_INCOMPLETA" });
        continue;
      }

      if (dryRun) {
        procesados += 1;
        detalle.push({ solicitud_id: doc.id, outcome: "dry_run", codigo: "CANDIDATO_OK" });
        continue;
      }

      const r = await invalidarVencimientoIncompletaEnTransaccion(db, doc.id);
      if (r.outcome === "procesado") {
        procesados += 1;
        detalle.push({
          solicitud_id: doc.id,
          outcome: "procesado",
          mdc_ok: r.mdc_mutacion?.ok === true,
        });
      } else if (r.outcome === "omitido") {
        omitidos += 1;
        detalle.push({ solicitud_id: doc.id, outcome: "omitido", codigo: r.codigo });
      } else {
        errores.push({ solicitud_id: doc.id, codigo: r.codigo, mdc: r.mdc_mutacion });
      }
    }

    if (!tieneMas) break;
  }

  return {
    ok: errores.length === 0,
    dry_run: dryRun,
    candidatos_query: candidatosQuery,
    procesados,
    omitidos,
    errores,
    paginas_ejecutadas: paginas,
    tiene_mas: tieneMas && paginas >= maxPaginas,
    detalle,
  };
}

module.exports = {
  COL_SOL,
  ESTADO_RECHAZADA,
  MOTIVO_RECHAZO_VENCIMIENTO_INCOMPLETA,
  esCandidatoVencimientoIncompleta,
  invalidarVencimientoIncompletaEnTransaccion,
  procesarVencimientosLicenciaIncompleta,
};
