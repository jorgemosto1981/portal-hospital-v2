"use strict";

const { FieldValue } = require("firebase-admin/firestore");

const COL_GRILLA_SYNC_GRUPO_MES = "grilla_sync_grupo_mes";

const ESTADO_IDLE = "idle";
const ESTADO_EN_CURSO = "en_curso";
const ESTADO_PENDIENTE = "pendiente";

/**
 * @param {string} grupoTrabajoId
 * @param {number} anio
 * @param {number} mes
 */
function buildGrillaSyncGrupoMesDocId(grupoTrabajoId, anio, mes) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  const mm = String(m).padStart(2, "0");
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error("buildGrillaSyncGrupoMesDocId: gdt, anio o mes inválidos.");
  }
  return `${gdt}_${y}_${mm}`;
}

/**
 * @param {string} periodoYm — yyyy-mm
 */
function periodoYmDesdeAnioMes(anio, mes) {
  return `${Number(anio)}-${String(mes).padStart(2, "0")}`;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string; anio: number; mes: number }} opts
 */
async function leerGrillaSyncGrupoMes(db, { grupoTrabajoId, anio, mes }) {
  const docId = buildGrillaSyncGrupoMesDocId(grupoTrabajoId, anio, mes);
  const snap = await db.collection(COL_GRILLA_SYNC_GRUPO_MES).doc(docId).get();
  if (!snap.exists) {
    return {
      ok: true,
      existe: false,
      doc_id: docId,
      grupo_trabajo_id: grupoTrabajoId,
      periodo: periodoYmDesdeAnioMes(anio, mes),
      estado: ESTADO_IDLE,
    };
  }
  const data = snap.data() || {};
  return {
    ok: true,
    existe: true,
    doc_id: docId,
    ...data,
  };
}

/**
 * Marca reconciliación pendiente (idempotente). No ejecuta materialización.
 *
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   grupoTrabajoId: string;
 *   anio: number;
 *   mes: number;
 *   metadata?: Record<string, unknown>;
 *   origen?: string;
 * }} opts
 */
async function marcarGrillaSyncGrupoMesPendiente(db, {
  grupoTrabajoId,
  anio,
  mes,
  metadata = {},
  origen = "listar",
}) {
  const gdt = String(grupoTrabajoId || "").trim();
  const docId = buildGrillaSyncGrupoMesDocId(gdt, anio, mes);
  const ref = db.collection(COL_GRILLA_SYNC_GRUPO_MES).doc(docId);
  const periodo = periodoYmDesdeAnioMes(anio, mes);

  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const prev = snap.exists ? snap.data() || {} : {};
    if (prev.estado === ESTADO_EN_CURSO) {
      return { ok: true, doc_id: docId, omitido: true, motivo: "en_curso" };
    }
    const metaIn = metadata && typeof metadata === "object" ? metadata : {};
    t.set(
      ref,
      {
        gdt,
        periodo,
        anio: Number(anio),
        mes: Number(mes),
        estado: ESTADO_PENDIENTE,
        solicitado_at: FieldValue.serverTimestamp(),
        origen_ultima_solicitud: String(origen || "listar").slice(0, 64),
        metadata: {
          ...((prev.metadata && typeof prev.metadata === "object") ? prev.metadata : {}),
          ...metaIn,
        },
        error: null,
      },
      { merge: true },
    );
    return { ok: true, doc_id: docId, estado: ESTADO_PENDIENTE };
  });
}

/**
 * Ejecuta materialización de grupo y actualiza doc de sync.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string; anio: number; mes: number; planCache?: object | null }} opts
 */
async function ejecutarReconciliacionGrillaSyncGrupoMes(db, {
  grupoTrabajoId,
  anio,
  mes,
  planCache: planCacheIn,
}) {
  const gdt = String(grupoTrabajoId || "").trim();
  const docId = buildGrillaSyncGrupoMesDocId(gdt, anio, mes);
  const ref = db.collection(COL_GRILLA_SYNC_GRUPO_MES).doc(docId);

  const claim = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      return { ok: false, codigo: "SIN_DOC" };
    }
    const data = snap.data() || {};
    if (data.estado !== ESTADO_PENDIENTE) {
      return { ok: true, omitido: true, motivo: data.estado || "no_pendiente" };
    }
    t.update(ref, {
      estado: ESTADO_EN_CURSO,
      iniciado_at: FieldValue.serverTimestamp(),
      error: null,
    });
    return { ok: true, reclamado: true };
  });

  if (!claim.ok || claim.omitido || !claim.reclamado) {
    return claim;
  }

  const { materializarGrupoMes } = require("../asistencia/rdaTurnoTeoricoWorker");

  let planCache = planCacheIn;
  if (!planCache) {
    const mm = String(mes).padStart(2, "0");
    const periodoId = `${anio}-${mm}`;
    const { planHabilitadoDesdeQuerySnapshot } = require("../asistencia/planGrupoAgentesNuevos");
    const planSnap = await db.collection("planes_turno_servicio")
      .where("grupo_id", "==", gdt)
      .where("periodo", "==", periodoId)
      .where("estado", "==", "HABILITADO")
      .limit(20)
      .get();
    planCache = planHabilitadoDesdeQuerySnapshot(planSnap);
  }

  try {
    const mat = await materializarGrupoMes({
      grupoId: gdt,
      anio,
      mes,
      planCache,
    });
    await ref.set(
      {
        estado: ESTADO_IDLE,
        ultimo_ok_at: FieldValue.serverTimestamp(),
        metadata: {
          materializacion_grupo: {
            ok: mat.ok === true,
            procesados: mat.procesados ?? 0,
            fallos: Array.isArray(mat.fallos) ? mat.fallos.length : 0,
          },
        },
        error: null,
      },
      { merge: true },
    );
    return { ok: true, materializacion: mat };
  } catch (e) {
    const mensaje = String(e?.message || e).slice(0, 500);
    await ref.set(
      {
        estado: ESTADO_PENDIENTE,
        error: { mensaje, en: FieldValue.serverTimestamp() },
      },
      { merge: true },
    );
    return { ok: false, codigo: "MATERIALIZACION_ERROR", mensaje };
  }
}

/**
 * @param {object} before
 * @param {object} after
 */
function debeDispararReconciliacionSyncGrilla(before, after) {
  if (!after || after.estado !== ESTADO_PENDIENTE) return false;
  if (before?.estado === ESTADO_EN_CURSO) return false;
  if (before?.estado === ESTADO_PENDIENTE) return false;
  return true;
}

/**
 * Tras listar: alinea doc de sync con sync_estado calculado.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string; anio: number; mes: number; sync_estado?: object }} opts
 */
async function alinearGrillaSyncTrasListar(db, { grupoTrabajoId, anio, mes, sync_estado: syncEstado }) {
  const se = syncEstado && typeof syncEstado === "object" ? syncEstado : {};
  const pendiente =
    se.reconciliacion === "pendiente"
    || Number(se.filas_sin_vis) > 0
    || Number(se.filas_degeneradas) > 0;
  if (!pendiente) {
    return { ok: true, encolado: false };
  }
  return marcarGrillaSyncGrupoMesPendiente(db, {
    grupoTrabajoId,
    anio,
    mes,
    origen: "listar_snapshot",
    metadata: {
      filas_sin_vis: Number(se.filas_sin_vis) || 0,
      filas_degeneradas: Number(se.filas_degeneradas) || 0,
      ultima_sync_max: se.ultima_sync_max || null,
    },
  });
}

module.exports = {
  COL_GRILLA_SYNC_GRUPO_MES,
  ESTADO_IDLE,
  ESTADO_EN_CURSO,
  ESTADO_PENDIENTE,
  buildGrillaSyncGrupoMesDocId,
  leerGrillaSyncGrupoMes,
  marcarGrillaSyncGrupoMesPendiente,
  ejecutarReconciliacionGrillaSyncGrupoMes,
  debeDispararReconciliacionSyncGrilla,
  alinearGrillaSyncTrasListar,
};
