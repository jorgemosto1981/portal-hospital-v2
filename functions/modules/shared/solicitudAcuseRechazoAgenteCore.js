"use strict";

const { FieldValue } = require("./context");
const { ESTADO_SOLICITUD_RECHAZADA } = require("./solicitudesArticuloEstados");
const { TIPO_EVENTO_TICKET, ORIGEN_EVENTO } = require("./solicitudEventosTicketConstants");
const { registrarEventoTicket } = require("./registrarEventoTicket");

const COL_SOL = "solicitudes_articulo";
const COL_PERSONAS = "personas";
const COL_GDT = "grupos_de_trabajo";
const COL_ART = "cfg_articulos";

/**
 * @param {Record<string, unknown>} sol
 * @returns {"auditor" | "rrhh" | "jefe" | "sistema" | ""}
 */
function rolActorRechazo(sol) {
  const am = sol.auditor_medico_clasificacion;
  if (am && typeof am === "object") {
    const id = String(am.auditor_persona_id || "").trim();
    if (/^per_/i.test(id)) return "auditor";
  }
  if (/^per_/i.test(String(sol.rrhh_revision_persona_id || "").trim())) return "rrhh";
  if (/^per_/i.test(String(sol.jefe_revision_persona_id || "").trim())) return "jefe";
  if (Array.isArray(sol.motor_codigos) && sol.motor_codigos.length) return "sistema";
  if (String(sol.motivo_rechazo_id || "").trim()) return "sistema";
  return "";
}

/**
 * @param {"auditor" | "rrhh" | "jefe" | "sistema" | ""} rol
 */
function labelRolRechazo(rol) {
  if (rol === "auditor") return "Auditoría médica";
  if (rol === "rrhh") return "RRHH";
  if (rol === "jefe") return "Jefatura";
  if (rol === "sistema") return "Sistema (validación)";
  return "Autoridad competente";
}

/**
 * Nombre humano si existe en `personas`; nunca devolver `per_*` crudo al agente.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} personaId
 * @param {string} fallbackRolLabel
 */
async function labelPersona(db, personaId, fallbackRolLabel) {
  const id = String(personaId || "").trim();
  const fallback = String(fallbackRolLabel || "Autoridad competente").trim();
  if (!/^per_/i.test(id)) return fallback;
  // IDs de smoke / fixtures sin doc real en personas.
  if (/SMOKE/i.test(id) || /_TEST_/i.test(id)) return fallback;
  try {
    const snap = await db.collection(COL_PERSONAS).doc(id).get();
    if (!snap.exists) return fallback;
    const p = snap.data() || {};
    const nom = [p.apellido, p.nombre].filter(Boolean).join(", ").trim();
    return nom || fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {Record<string, unknown>} sol
 */
function personaIdActorRechazo(sol) {
  const am = sol.auditor_medico_clasificacion;
  if (am && typeof am === "object") {
    const id = String(am.auditor_persona_id || "").trim();
    if (/^per_/i.test(id)) return id;
  }
  const rrhh = String(sol.rrhh_revision_persona_id || "").trim();
  if (/^per_/i.test(rrhh)) return rrhh;
  const jefe = String(sol.jefe_revision_persona_id || "").trim();
  if (/^per_/i.test(jefe)) return jefe;
  return "";
}

/**
 * @param {Record<string, unknown>} sol
 */
function motivoRechazoTexto(sol) {
  const jefe = String(sol.jefe_motivo || "").trim();
  if (jefe) return jefe;
  const rrhh = String(sol.rrhh_motivo || "").trim();
  if (rrhh) return rrhh;
  const det = String(sol.motivo_rechazo_detalle || "").trim();
  if (det) return det;
  const msgs = Array.isArray(sol.motor_mensajes)
    ? sol.motor_mensajes.map((m) => String(m || "").trim()).filter(Boolean)
    : [];
  if (msgs.length) return msgs.join(" · ");
  return "";
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} solId
 * @param {string} titularPersonaId
 */
async function obtenerContextoAcuseRechazoAgente(db, solId, titularPersonaId) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.titular_persona_id || "").trim() !== String(titularPersonaId || "").trim()) {
    return { ok: false, codigo: "FORBIDDEN", mensaje: "No podés ver esta solicitud." };
  }
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_RECHAZADA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo aplica a solicitudes rechazadas.",
    };
  }

  const artId = String(sol.articulo_id || "").trim();
  let articuloLabel = "";
  if (/^art_/i.test(artId)) {
    const aSnap = await db.collection(COL_ART).doc(artId).get();
    if (aSnap.exists) {
      const a = aSnap.data() || {};
      const cod = String(a.codigo_grilla || a.codigo || "").trim();
      const nom = String(a.nombre || a.nombre_corto || "").trim();
      articuloLabel = cod && nom ? `${cod} — ${nom}` : nom || cod || artId;
    }
  }
  if (sol.es_cambio_dia === true) {
    articuloLabel = articuloLabel || "Cambio de Día de Asistencia";
  }
  if (String(sol.schema_version || "") === "SOL_MED_AVISO_V1") {
    articuloLabel = articuloLabel || "Aviso de licencia médica";
  }

  const gdtId = String(sol.grupo_trabajo_id_ancla || "").trim();
  let gdtNombre = "";
  if (/^gdt_/i.test(gdtId)) {
    const gSnap = await db.collection(COL_GDT).doc(gdtId).get();
    if (gSnap.exists) {
      const g = gSnap.data() || {};
      gdtNombre = String(g.nombre || g.nombre_corto || "").trim();
    }
  }

  const actorId = personaIdActorRechazo(sol);
  const rol = rolActorRechazo(sol);
  const rolLabel = labelRolRechazo(rol);
  const revisorLabel = actorId
    ? await labelPersona(db, actorId, rolLabel)
    : rolLabel;

  return {
    ok: true,
    solicitud_id: solId,
    articulo_label: articuloLabel || "Solicitud",
    grupo_label: gdtNombre || gdtId || "—",
    fecha_desde: String(sol.fecha_desde || sol.fecha_origen || "").slice(0, 10) || null,
    fecha_hasta: String(sol.fecha_hasta || sol.fecha_destino || "").slice(0, 10) || null,
    motivo: motivoRechazoTexto(sol) || null,
    revisor_persona_id: actorId || null,
    revisor_rol: rol || null,
    revisor_label: revisorLabel || rolLabel,
    ya_acusado: Boolean(sol.agente_acuse_rechazo_en),
  };
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} solId
 * @param {string} titularPersonaId
 */
async function registrarAcuseRechazoAgente(db, solId, titularPersonaId) {
  const solRef = db.collection(COL_SOL).doc(solId);
  const solSnap = await solRef.get();
  if (!solSnap.exists) {
    return { ok: false, codigo: "NOT_FOUND", mensaje: "La solicitud no existe." };
  }
  const sol = solSnap.data() || {};
  if (String(sol.titular_persona_id || "").trim() !== String(titularPersonaId || "").trim()) {
    return { ok: false, codigo: "FORBIDDEN", mensaje: "Solo el titular puede tomar conocimiento." };
  }
  if (String(sol.estado_solicitud_id) !== ESTADO_SOLICITUD_RECHAZADA) {
    return {
      ok: false,
      codigo: "ESTADO_INVALIDO",
      mensaje: "Solo se registra acuse en solicitudes rechazadas.",
    };
  }
  if (sol.agente_acuse_rechazo_en) {
    return {
      ok: true,
      codigo: "TC_YA_REGISTRADA",
      mensaje: "La toma de conocimiento ya fue registrada.",
      idempotente: true,
    };
  }

  await solRef.update({
    agente_acuse_rechazo_persona_id: titularPersonaId,
    agente_acuse_rechazo_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  });

  void Promise.resolve(
    registrarEventoTicket(db, solId, {
      tipo_evento: TIPO_EVENTO_TICKET.ESTADO_CAMBIADO,
      actor_persona_id: titularPersonaId,
      titular_persona_id: titularPersonaId,
      estado_anterior_id: ESTADO_SOLICITUD_RECHAZADA,
      estado_nuevo_id: ESTADO_SOLICITUD_RECHAZADA,
      origen: ORIGEN_EVENTO.CALLABLE,
      accion: "agente_acuse_rechazo",
      metadata: {
        articulo_id: String(sol.articulo_id || "") || null,
        fecha_desde: String(sol.fecha_desde || "").slice(0, 10) || null,
      },
    }),
  ).catch(() => {
    // Acuse ya persistido; el evento es best-effort.
  });

  return {
    ok: true,
    solicitud_id: solId,
    mensaje: "Toma de conocimiento registrada.",
  };
}

module.exports = {
  registrarAcuseRechazoAgente,
  obtenerContextoAcuseRechazoAgente,
};
