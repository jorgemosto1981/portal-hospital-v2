"use strict";

/**
 * Callables para gestión de overrides puntuales en asistencia_diaria.
 *
 * Override = cambio operativo diario que diverge del turno teórico:
 *   - "reemplazo": sustituye el turno teórico (ej. cambio de franco).
 *   - "adicional": se suma al turno teórico (ej. doble guardia de urgencia).
 *
 * Se almacena en asistencia_diaria.overrides_turno[] como array.
 */

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { db, FieldValue } = require("../shared/context");
const { materializarTurnoMesBatch } = require("./rdaTurnoTeoricoWorker");
const { logger } = require("firebase-functions/v2");

const COL_ASISTENCIA = "asistencia_diaria";
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_OVERRIDE = new Set(["reemplazo", "adicional"]);

function err(code, msg) {
  throw new HttpsError(code, msg);
}

function docIdAsistencia(personaId, fechaYmd) {
  return `asi_${personaId}_${fechaYmd.replace(/-/g, "")}`;
}

function validarInput(data) {
  if (!data || typeof data !== "object") err("invalid-argument", "[OVR-001] datos requeridos.");

  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
  if (!personaId) err("invalid-argument", "[OVR-002] persona_id requerido.");

  const fecha = typeof data.fecha === "string" ? data.fecha.trim() : "";
  if (!YMD.test(fecha)) err("invalid-argument", "[OVR-003] fecha YYYY-MM-DD requerida.");

  return { personaId, fecha };
}

function validarOverride(ov) {
  if (!ov || typeof ov !== "object") err("invalid-argument", "[OVR-010] override requerido.");

  const tipo = typeof ov.tipo === "string" ? ov.tipo.trim() : "";
  if (!TIPOS_OVERRIDE.has(tipo)) err("invalid-argument", "[OVR-011] tipo debe ser 'reemplazo' o 'adicional'.");

  const motivo = typeof ov.motivo === "string" ? ov.motivo.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-012] motivo requerido (mín. 3 caracteres).");

  const ingreso = typeof ov.ingreso === "string" && HH_MM.test(ov.ingreso) ? ov.ingreso : null;
  const egreso = typeof ov.egreso === "string" && HH_MM.test(ov.egreso) ? ov.egreso : null;
  const horas_efectivas = typeof ov.horas_efectivas === "number" && ov.horas_efectivas >= 0 && ov.horas_efectivas <= 24
    ? ov.horas_efectivas : null;
  const turno_id = typeof ov.turno_id === "string" && ov.turno_id.trim() ? ov.turno_id.trim() : null;

  return { tipo, ingreso, egreso, horas_efectivas, turno_id, motivo };
}

/**
 * Registra un override puntual en asistencia_diaria.overrides_turno[].
 * Si el doc no existe lo crea con estructura mínima.
 */
const registrarCambioTurno = onCall({ invoker: "public" }, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);
  const override = validarOverride(data.override);

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  const entry = {
    ...override,
    es_override_manual: true,
    creado_por_uid: uid,
    creado_por_persona_id: token.persona_id || null,
    creado_en: new Date().toISOString(),
    invalidado_por_replanificacion: false,
  };

  const docId = docIdAsistencia(personaId, fecha);
  const ref = db.collection(COL_ASISTENCIA).doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    await ref.update({
      overrides_turno: FieldValue.arrayUnion(entry),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      persona_id: personaId,
      fecha: fecha,
      overrides_turno: [entry],
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  }

  const updated = await ref.get();
  const overrides = updated.exists && Array.isArray(updated.data().overrides_turno)
    ? updated.data().overrides_turno : [];

  const [anio, mes] = fecha.split("-").map(Number);
  try {
    await materializarTurnoMesBatch({ personaId, grupoId: null, anio, mes });
    logger.info("materializarTurnoMesBatch_post_override OK", { personaId, fecha });
  } catch (e) {
    logger.error("materializarTurnoMesBatch_post_override ERROR", { personaId, fecha, error: String(e) });
  }

  return {
    ok: true,
    doc_id: docId,
    total_overrides: overrides.length,
    override_registrado: entry,
  };
});

/**
 * Elimina (marca como eliminado) un override por índice.
 * No borra físicamente: marca eliminado_en + motivo para auditoría.
 */
const eliminarCambioTurno = onCall({ invoker: "public" }, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);

  const idx = typeof data.override_index === "number" ? data.override_index : -1;
  if (idx < 0) err("invalid-argument", "[OVR-DEL-001] override_index (>=0) requerido.");

  const motivo = typeof data.motivo_eliminacion === "string" ? data.motivo_eliminacion.trim() : "";
  if (motivo.length < 3) err("invalid-argument", "[OVR-DEL-002] motivo_eliminacion requerido (mín. 3 caracteres).");

  const uid = (request.auth && request.auth.uid) || "system";
  const token = (request.auth && request.auth.token) || {};

  const docId = docIdAsistencia(personaId, fecha);
  const ref = db.collection(COL_ASISTENCIA).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) err("not-found", "[OVR-DEL-003] Documento de asistencia no encontrado.");

  const overrides = Array.isArray(snap.data().overrides_turno) ? [...snap.data().overrides_turno] : [];
  if (idx >= overrides.length) err("out-of-range", `[OVR-DEL-004] Índice ${idx} fuera de rango (${overrides.length} overrides).`);

  overrides[idx] = {
    ...overrides[idx],
    eliminado: true,
    eliminado_en: new Date().toISOString(),
    eliminado_por_uid: uid,
    eliminado_por_persona_id: token.persona_id || null,
    motivo_eliminacion: motivo,
  };

  await ref.update({
    overrides_turno: overrides,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  const [anio, mes] = fecha.split("-").map(Number);
  try {
    await materializarTurnoMesBatch({ personaId, grupoId: null, anio, mes });
    logger.info("materializarTurnoMesBatch_post_eliminar_override OK", { personaId, fecha });
  } catch (e) {
    logger.error("materializarTurnoMesBatch_post_eliminar_override ERROR", { personaId, fecha, error: String(e) });
  }

  return { ok: true, doc_id: docId, override_eliminado_index: idx };
});

/**
 * Lista overrides activos de un agente para una fecha.
 */
const listarOverridesTurno = onCall({ invoker: "public" }, async (request) => {
  const data = request.data;
  const { personaId, fecha } = validarInput(data);

  const docId = docIdAsistencia(personaId, fecha);
  const snap = await db.collection(COL_ASISTENCIA).doc(docId).get();
  if (!snap.exists) return { items: [], doc_id: docId };

  const all = Array.isArray(snap.data().overrides_turno) ? snap.data().overrides_turno : [];
  const activos = all.filter((o) => !o.eliminado && !o.invalidado_por_replanificacion);

  return {
    items: activos,
    total: all.length,
    activos: activos.length,
    doc_id: docId,
  };
});

module.exports = {
  registrarCambioTurno,
  eliminarCambioTurno,
  listarOverridesTurno,
};
