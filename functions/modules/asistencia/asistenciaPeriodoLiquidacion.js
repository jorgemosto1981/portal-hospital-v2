"use strict";

const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../shared/context");
const { buildVisDocumentId } = require("../shared/mdcRdaDocumentIds");
const {
  CFG_EPL_ABIERTO,
  CFG_EPL_LIQUIDADO_CERRADO,
} = require("../shared/cfgAsistenciaTurnosIds");

const COL_VIS = "vistas_grilla_mes_agente";

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId gdt_* — obligatorio (vis scoped)
 * @returns {Promise<{ cerrado: boolean, estado_periodo_liquidacion_id: string|null }>}
 */
async function consultarEstadoPeriodoLiquidacion(personaId, fechaYmd, grupoTrabajoId) {
  const visId = buildVisDocumentId(personaId, fechaYmd, grupoTrabajoId);
  const snap = await db.collection(COL_VIS).doc(visId).get();
  if (!snap.exists) return { cerrado: false, estado_periodo_liquidacion_id: null };
  const id = snap.data()?.estado_periodo_liquidacion_id || null;
  return {
    cerrado: id === CFG_EPL_LIQUIDADO_CERRADO,
    estado_periodo_liquidacion_id: id,
  };
}

/**
 * @param {string} personaId
 * @param {string} fechaYmd
 * @param {string} grupoTrabajoId gdt_*
 * @returns {Promise<void>}
 */
async function assertPeriodoNoCerrado(personaId, fechaYmd, grupoTrabajoId) {
  const { cerrado } = await consultarEstadoPeriodoLiquidacion(personaId, fechaYmd, grupoTrabajoId);
  if (cerrado) {
    const err = new Error("[ASI-PER-001] El período está liquidado y cerrado. No se permiten cambios.");
    err.code = "failed-precondition";
    throw err;
  }
}

/**
 * Cierra liquidación de todas las vis_* del grupo en el mes (RRHH).
 * @param {import("firebase-admin/firestore").Firestore} firestore
 */
async function cerrarPeriodoLiquidacionCore(
  firestore,
  { grupoTrabajoId, anio, mes, actorPersonaId, motivo },
) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", actualizados: 0 };
  }

  const snap = await firestore
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("anio", "==", y)
    .where("mes", "==", m)
    .get();

  if (snap.empty) {
    return { ok: true, actualizados: 0, grupo_trabajo_id: gdt, anio: y, mes: m };
  }

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  const actor = String(actorPersonaId || "").trim() || null;
  const motivoTxt = motivo ? String(motivo).trim().slice(0, 500) : null;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      estado_periodo_liquidacion_id: CFG_EPL_LIQUIDADO_CERRADO,
      periodo_cerrado_en: now,
      periodo_cerrado_por_persona_id: actor,
      periodo_cierre_motivo: motivoTxt,
    });
  }
  await batch.commit();

  return {
    ok: true,
    actualizados: snap.size,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
  };
}

/**
 * Reabre período (solo RRHH, con motivo).
 */
async function reabrirPeriodoLiquidacionCore(
  firestore,
  { grupoTrabajoId, anio, mes, actorPersonaId, motivo },
) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", actualizados: 0 };
  }
  const motivoTxt = String(motivo || "").trim();
  if (motivoTxt.length < 3) {
    return { ok: false, codigo: "MOTIVO_REQUERIDO", actualizados: 0 };
  }

  const snap = await firestore
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("anio", "==", y)
    .where("mes", "==", m)
    .get();

  if (snap.empty) {
    return { ok: true, actualizados: 0, grupo_trabajo_id: gdt, anio: y, mes: m };
  }

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  const actor = String(actorPersonaId || "").trim() || null;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      estado_periodo_liquidacion_id: CFG_EPL_ABIERTO,
      periodo_reabierto_en: now,
      periodo_reabierto_por_persona_id: actor,
      periodo_reapertura_motivo: motivoTxt,
      periodo_cerrado_en: FieldValue.delete(),
      periodo_cerrado_por_persona_id: FieldValue.delete(),
      periodo_cierre_motivo: FieldValue.delete(),
    });
  }
  await batch.commit();

  return {
    ok: true,
    actualizados: snap.size,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
  };
}

module.exports = {
  consultarEstadoPeriodoLiquidacion,
  assertPeriodoNoCerrado,
  cerrarPeriodoLiquidacionCore,
  reabrirPeriodoLiquidacionCore,
  COL_VIS,
};
