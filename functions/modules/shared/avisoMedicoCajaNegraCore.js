"use strict";

const { FieldValue, Timestamp } = require("./context");
const {
  PARAM_LM_INCOMPLETA_PLAZO_HORAS,
  calcularVencimientoPlazoCertificado,
  resolverHorasDesdeParametroSistema,
} = require("./licenciaMedicaParametrosCore");

const ESTADO_PENDIENTE_CLASIFICACION = "cfg_esa_pendiente_clasificacion_medica";
const SCHEMA_MED_AVISO = "SOL_MED_AVISO_V1";

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function leerPlazoHorasLicenciaIncompleta(db) {
  const snap = await db.collection("cfg_parametros_sistema").doc(PARAM_LM_INCOMPLETA_PLAZO_HORAS).get();
  return resolverHorasDesdeParametroSistema(snap.exists ? snap.data() : null);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} titularPersonaId
 */
async function buscarAvisoIncompletaVigente(db, titularPersonaId) {
  const titular = String(titularPersonaId || "").trim();
  if (!/^per_/i.test(titular)) {
    return { ok: false, codigo: "TITULAR_INVALIDO" };
  }
  const qs = await db
    .collection("solicitudes_articulo")
    .where("titular_persona_id", "==", titular)
    .where("estado_solicitud_id", "==", ESTADO_PENDIENTE_CLASIFICACION)
    .limit(10)
    .get();

  const now = Date.now();
  for (const doc of qs.docs) {
    const d = doc.data() || {};
    if (d.schema_version !== SCHEMA_MED_AVISO) continue;
    const ing = d.ingreso_medico;
    if (!ing || ing.es_licencia_incompleta !== true) continue;
    const venc = d.vencimiento_plazo_certificado;
    const vencMs =
      venc && typeof venc.toDate === "function" ? venc.toDate().getTime() : NaN;
    if (Number.isFinite(vencMs) && vencMs > now) {
      return { ok: true, solicitud_id: doc.id, vencimiento_plazo_certificado: venc };
    }
  }
  return { ok: false, codigo: "SIN_AVISO_INCOMPLETA_VIGENTE" };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   solicitudId: string,
 *   titularPersonaId: string,
 *   adjuntos: Array<{ storage_path: string, content_type?: string, nombre_archivo?: string }>,
 *   fechaInicioReposoEstimada?: string,
 * }} input
 */
async function actualizarAvisoMedicoIncompleto(db, input) {
  const solicitudId = String(input.solicitudId || "").trim();
  const titularPersonaId = String(input.titularPersonaId || "").trim();
  const adjuntos = Array.isArray(input.adjuntos) ? input.adjuntos : [];

  if (!/^sol_/i.test(solicitudId)) {
    return { ok: false, codigo: "SOLICITUD_ID_INVALIDO", mensaje: "solicitud_id inválido." };
  }
  if (!/^per_/i.test(titularPersonaId)) {
    return { ok: false, codigo: "TITULAR_INVALIDO", mensaje: "Titular inválido." };
  }
  if (!adjuntos.length || !adjuntos.every((a) => a && typeof a.storage_path === "string" && a.storage_path.trim())) {
    return { ok: false, codigo: "ADJUNTO_REQUERIDO", mensaje: "Debés adjuntar al menos un certificado." };
  }

  const ref = db.collection("solicitudes_articulo").doc(solicitudId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, codigo: "NO_ENCONTRADA", mensaje: "Solicitud no encontrada." };
  }

  const d = snap.data() || {};
  if (d.titular_persona_id !== titularPersonaId) {
    return { ok: false, codigo: "NO_TITULAR", mensaje: "No podés modificar esta solicitud." };
  }
  if (d.estado_solicitud_id !== ESTADO_PENDIENTE_CLASIFICACION) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está pendiente de clasificación." };
  }
  if (d.schema_version !== SCHEMA_MED_AVISO) {
    return { ok: false, codigo: "SCHEMA_INVALIDO", mensaje: "No es un aviso médico Caja Negra." };
  }

  const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
  if (ing.es_licencia_incompleta !== true) {
    return { ok: false, codigo: "YA_COMPLETA", mensaje: "Esta solicitud ya no es un aviso incompleto." };
  }

  const venc = d.vencimiento_plazo_certificado;
  const vencDate = venc && typeof venc.toDate === "function" ? venc.toDate() : null;
  if (!vencDate || Date.now() >= vencDate.getTime()) {
    return {
      ok: false,
      codigo: "LICENCIA_INCOMPLETA_VENCIDA",
      mensaje: "Venció el plazo para completar el certificado. Contactá a RRHH.",
    };
  }

  const fechaYmd =
    typeof input.fechaInicioReposoEstimada === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.fechaInicioReposoEstimada.trim())
      ? input.fechaInicioReposoEstimada.trim()
      : null;

  const ingresoActualizado = {
    ...ing,
    adjuntos: adjuntos.map((a) => ({
      storage_path: String(a.storage_path).trim(),
      ...(a.content_type ? { content_type: String(a.content_type).slice(0, 128) } : {}),
      ...(a.nombre_archivo ? { nombre_archivo: String(a.nombre_archivo).slice(0, 256) } : {}),
    })),
    es_licencia_incompleta: false,
    completado_en: FieldValue.serverTimestamp(),
  };

  /** @type {Record<string, unknown>} */
  const patch = {
    ingreso_medico: ingresoActualizado,
    actualizado_en: FieldValue.serverTimestamp(),
  };
  if (fechaYmd) {
    patch.fecha_inicio_reposo_estimada = fechaYmd;
  }

  await ref.update(patch);

  return {
    ok: true,
    solicitud_id: solicitudId,
    estado_solicitud_id: ESTADO_PENDIENTE_CLASIFICACION,
    mensaje_ui: "Certificado registrado. Medicina laboral clasificará tu caso.",
  };
}

module.exports = {
  ESTADO_PENDIENTE_CLASIFICACION,
  SCHEMA_MED_AVISO,
  leerPlazoHorasLicenciaIncompleta,
  buscarAvisoIncompletaVigente,
  actualizarAvisoMedicoIncompleto,
  calcularVencimientoPlazoCertificado,
};
