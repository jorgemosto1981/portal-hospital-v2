"use strict";

const { FieldValue } = require("./context");
const {
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_RECHAZADA,
  ESTADO_SOLICITUD_APROBADA,
} = require("./solicitudesArticuloEstados");
/** Oleada A — visibilidad RRHH (RFC §2 ítem 17). */
const ESTADOS_BANDEJA_RRHH_VISIBLES = [
  ESTADO_SOLICITUD_EN_REVISION_JEFE,
  ESTADO_SOLICITUD_EN_REVISION_RRHH,
  ESTADO_SOLICITUD_APROBADA,
];

/**
 * @param {Record<string, unknown>} sol
 */
function bandejaRrhhModoItem(sol) {
  const est = String(sol.estado_solicitud_id || "").trim();
  if (est === ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return {
      modo: "legacy_rrhh",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Pendiente RRHH (legacy)",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE && sol.autorizacion_rrhh_sustituta === true) {
    return {
      modo: "cierre_sustituta",
      puede_aprobar_rechazar: true,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "Huérfana — cierre RRHH",
    };
  }
  if (est === ESTADO_SOLICITUD_EN_REVISION_JEFE) {
    return {
      modo: "visibilidad_jefe",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: false,
      etiqueta_estado: "En revisión por jefatura",
    };
  }
  if (est === ESTADO_SOLICITUD_APROBADA) {
    if (sol.rrhh_toma_conocimiento_en) {
      return {
        modo: "toma_conocimiento_ok",
        puede_aprobar_rechazar: false,
        puede_registrar_toma_conocimiento: false,
        etiqueta_estado: "Toma de conocimiento registrada",
      };
    }
    return {
      modo: "toma_conocimiento",
      puede_aprobar_rechazar: false,
      puede_registrar_toma_conocimiento: true,
      etiqueta_estado: "Aprobada — pendiente toma de conocimiento RRHH",
    };
  }
  return {
    modo: "otro",
    puede_aprobar_rechazar: false,
    puede_registrar_toma_conocimiento: false,
    etiqueta_estado: est,
  };
}
const { loadArticuloDisplay } = require("./solicitudBandejaJefeCore");
const { revertirMotorBolsaPatronBEnTx } = require("./solicitudPatronBReversoSaldo");
const {
  dispararMdcDesdeSolicitudAsync,
  MDC_COMANDO_CONSOLIDAR_APROBADO,
  MDC_COMANDO_REVERTIR_PROYECCION,
} = require("./mdcTicketeraEmisor");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const LIST_LIMIT = 80;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
async function listarSolicitudesBandejaRrhh(db) {
  const snap = await db
    .collection(COL_SOL)
    .where("estado_solicitud_id", "in", ESTADOS_BANDEJA_RRHH_VISIBLES)
    .limit(LIST_LIMIT)
    .get();

  const out = [];
  const personaCache = new Map();
  const articuloCache = new Map();

  for (const doc of snap.docs) {
    const sol = { id: doc.id, ...(doc.data() || {}) };
    const titularId = String(sol.titular_persona_id || "").trim();
    const fechaRef = String(sol.fecha_desde || "").slice(0, 10);
    if (!/^per_/i.test(titularId) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaRef)) continue;

    let titularLabel = personaCache.get(titularId);
    if (titularLabel === undefined) {
      const pSnap = await db.collection(COL_PERSONAS).doc(titularId).get();
      const p = pSnap.exists ? pSnap.data() || {} : {};
      const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
      titularLabel = nom || titularId;
      personaCache.set(titularId, titularLabel);
    }

    const artId = String(sol.articulo_id || "").trim();
    const artDisplay = await loadArticuloDisplay(db, artId, articuloCache);
    const modo = bandejaRrhhModoItem(sol);

    out.push({
      solicitud_id: sol.id,
      articulo_id: artId,
      articulo_label: artDisplay.articulo_label,
      codigo_grilla: artDisplay.codigo_grilla,
      articulo_nombre: artDisplay.nombre,
      titular_persona_id: titularId,
      titular_label: titularLabel,
      fecha_desde: fechaRef,
      fecha_hasta: String(sol.fecha_hasta || fechaRef).slice(0, 10),
      dias_solicitados: Number(sol.dias_solicitados) || 1,
      patron_saldo: String(sol.patron_saldo || ""),
      estado_solicitud_id: sol.estado_solicitud_id,
      jefe_revision_en: sol.jefe_revision_en || null,
      autorizadores_elegibles_ids: Array.isArray(sol.autorizadores_elegibles_ids)
        ? sol.autorizadores_elegibles_ids
        : [],
      autorizacion_rrhh_sustituta: sol.autorizacion_rrhh_sustituta === true,
      bandeja_rrhh_modo: modo.modo,
      puede_aprobar_rechazar: modo.puede_aprobar_rechazar,
      puede_registrar_toma_conocimiento: modo.puede_registrar_toma_conocimiento === true,
      etiqueta_estado: modo.etiqueta_estado,
      rrhh_toma_conocimiento_en: sol.rrhh_toma_conocimiento_en || null,
    });
  }

  out.sort((a, b) => String(b.fecha_desde).localeCompare(String(a.fecha_desde)));
  return { solicitudes: out, limite: LIST_LIMIT };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {"aprobar"|"rechazar"} decision
 * @param {string} motivo
 */
async function resolverDecisionRrhhSolicitud(db, solId, revisorPersonaId, decision, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_RRHH) {
    return { ok: false, codigo: "ESTADO_INVALIDO", mensaje: "La solicitud ya no está en revisión RRHH." };
  }

  const titularId = String(sol.titular_persona_id || "").trim();

  if (decision === "aprobar") {
    await solRef.update({
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
      rrhh_revision_persona_id: revisorPersonaId,
      rrhh_revision_en: FieldValue.serverTimestamp(),
      rrhh_motivo: motivo || null,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      {
        ...sol,
        estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
        codigo_grilla: artDisplay.codigo_grilla,
      },
      MDC_COMANDO_CONSOLIDAR_APROBADO,
    );
    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
    };
  }

  if (decision === "rechazar") {
    let reverso = false;
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(solRef);
      if (!sSnap.exists) return;
      const cur = sSnap.data() || {};
      if (String(cur.estado_solicitud_id) !== ESTADO_SOLICITUD_EN_REVISION_RRHH) return;

      reverso = await revertirMotorBolsaPatronBEnTx(tx, db, cur, titularId);

      tx.update(solRef, {
        estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
        rrhh_revision_persona_id: revisorPersonaId,
        rrhh_revision_en: FieldValue.serverTimestamp(),
        rrhh_motivo: motivo || null,
        motor_reverso_rrhh_aplicado: cur.motor_descuento_aplicado === true,
        actualizado_en: FieldValue.serverTimestamp(),
      });
    });
    const artCache = new Map();
    const artDisplay = await loadArticuloDisplay(db, String(sol.articulo_id || ""), artCache);
    dispararMdcDesdeSolicitudAsync(
      db,
      solId,
      { ...sol, codigo_grilla: artDisplay.codigo_grilla },
      MDC_COMANDO_REVERTIR_PROYECCION,
    );

    return {
      ok: true,
      solicitud_id: solId,
      estado_solicitud_id: ESTADO_SOLICITUD_RECHAZADA,
      motor_reverso_rrhh_aplicado: reverso,
    };
  }

  return { ok: false, codigo: "DECISION_INVALIDA", mensaje: "Decisión inválida." };
}

/**
 * Toma de conocimiento RRHH (Oleada A4): no cambia estado sustantivo.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {string} revisorPersonaId
 * @param {string} motivo
 */
async function registrarTomaConocimientoRrhhSolicitud(db, solId, revisorPersonaId, motivo) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_APROBADA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo se registra toma de conocimiento en solicitudes ya aprobadas por jefatura.",
    };
  }
  if (sol.rrhh_toma_conocimiento_en) {
    return {
      ok: false,
      codigo: "TC_YA_REGISTRADA",
      mensaje: "La toma de conocimiento ya fue registrada.",
    };
  }

  await solRef.update({
    rrhh_toma_conocimiento_persona_id: revisorPersonaId,
    rrhh_toma_conocimiento_en: FieldValue.serverTimestamp(),
    rrhh_toma_conocimiento_motivo: motivo || null,
    actualizado_en: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    solicitud_id: solId,
    estado_solicitud_id: ESTADO_SOLICITUD_APROBADA,
  };
}

module.exports = {
  listarSolicitudesBandejaRrhh,
  resolverDecisionRrhhSolicitud,
  registrarTomaConocimientoRrhhSolicitud,
};
