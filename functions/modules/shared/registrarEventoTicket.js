"use strict";

const { ulid } = require("ulid");
const { logger } = require("firebase-functions");
const { FieldValue } = require("./context");
const { buildEventoV21, buildPersonaLabel, persistEventoV21, formatPeriodoYyyymm } = require("./eventosV2");
const {
  TIPO_EVENTO_TICKET,
  TIPO_EVENTO_TICKET_CFG,
  TICKET_EVENTOS_SCHEMA_VERSION,
} = require("./solicitudEventosTicketConstants");

const COL_SOL = "solicitudes_articulo";
const SUB_EVENTOS = "eventos_ticket";

const METADATA_MAX_KEYS = 24;
const METADATA_MAX_STRING = 500;

function subcolRef(db, solId, evtId) {
  return db.collection(COL_SOL).doc(solId).collection(SUB_EVENTOS).doc(evtId);
}

function resolveTipoCfg(tipoEvento) {
  const cfg = TIPO_EVENTO_TICKET_CFG[tipoEvento];
  if (!cfg) return null;
  return cfg;
}

function sanitizeMetadata(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= METADATA_MAX_KEYS) break;
    const key = String(k).slice(0, 80);
    if (v == null) {
      out[key] = null;
      n += 1;
      continue;
    }
    if (typeof v === "string") {
      out[key] = v.slice(0, METADATA_MAX_STRING);
      n += 1;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[key] = v;
      n += 1;
    }
  }
  return out;
}

function buildPayloadUi(tipoEvento, solId, evento) {
  const meta = evento.metadata || {};
  const codigoGrilla = meta.codigo_grilla ? String(meta.codigo_grilla) : "";
  const fecha = meta.fecha_desde ? String(meta.fecha_desde) : "";

  if (tipoEvento === TIPO_EVENTO_TICKET.SOLICITUD_CREADA_REVISION_JEFE) {
    return {
      titulo: "Solicitud enviada a jefatura",
      resumen: codigoGrilla
        ? `Solicitud ${solId} (${codigoGrilla}) en revisión por jefe.`
        : `Solicitud ${solId} en revisión por jefe.`,
      entidad: "solicitudes_articulo",
      persona_afectada_label: evento._persona_label || "Titular",
      actor_label: evento._persona_label || "Titular",
    };
  }
  if (tipoEvento === TIPO_EVENTO_TICKET.TOMA_CONOCIMIENTO_RRHH) {
    return {
      titulo: "Toma de conocimiento RRHH",
      resumen: `RRHH registró toma de conocimiento sobre ${solId}${codigoGrilla ? ` (${codigoGrilla})` : ""}.`,
      entidad: "solicitudes_articulo",
      persona_afectada_label: evento._persona_label || "Titular",
      actor_label: evento._actor_label || "RRHH",
    };
  }
  const decision = meta.decision ? String(meta.decision) : "cambio";
  return {
    titulo: "Cambio de estado de solicitud",
    resumen: `Solicitud ${solId}: ${decision}${fecha ? ` · ${fecha}` : ""}.`,
    entidad: "solicitudes_articulo",
    persona_afectada_label: evento._persona_label || "Titular",
    actor_label: evento._actor_label || "Revisor",
  };
}

function buildSubcolDocument(solId, evtId, evento, tipoCfg) {
  const periodo =
    evento.periodo_yyyymm ||
    (evento.metadata && evento.metadata.periodo) ||
    formatPeriodoYyyymm();
  return {
    id: evtId,
    schema_version: TICKET_EVENTOS_SCHEMA_VERSION,
    solicitud_id: solId,
    tipo_evento: evento.tipo_evento,
    tipo_evento_id: tipoCfg.tipo_evento_id,
    ocurrido_en: FieldValue.serverTimestamp(),
    actor_persona_id: evento.actor_persona_id ?? null,
    actor_uid: evento.actor_uid ?? null,
    estado_anterior_id: evento.estado_anterior_id ?? null,
    estado_nuevo_id: evento.estado_nuevo_id ?? null,
    accion: evento.accion || tipoCfg.accion_default,
    origen: evento.origen || "SISTEMA",
    periodo_yyyymm: periodo,
    metadata: sanitizeMetadata(evento.metadata),
  };
}

/**
 * Capa canónica global (mismo evtId). Idempotente vía merge en persistEventoV21.
 */
async function persistEventoTicketGlobal(db, solId, evtId, evento, tipoCfg) {
  const titularId = evento.titular_persona_id || evento.actor_persona_id || null;
  const canonico = buildEventoV21({
    id: evtId,
    tipo_evento_id: tipoCfg.tipo_evento_id,
    modulo_origen: "articulos",
    accion: evento.accion || tipoCfg.accion_default,
    persona_id: titularId,
    actor_uid: evento.actor_uid ?? null,
    actor_persona_id: evento.actor_persona_id ?? null,
    payload_ui: buildPayloadUi(evento.tipo_evento, solId, evento),
    payload_contexto: {
      sol_id: solId,
      estado_anterior_id: evento.estado_anterior_id ?? null,
      estado_nuevo_id: evento.estado_nuevo_id ?? null,
      ...sanitizeMetadata(evento.metadata),
    },
    payload_cambios:
      evento.estado_anterior_id !== evento.estado_nuevo_id
        ? [
            {
              campo: "estado_solicitud_id",
              label: "Estado solicitud",
              antes: evento.estado_anterior_id ?? null,
              despues: evento.estado_nuevo_id ?? null,
              tipo: "catalog_id",
            },
          ]
        : [],
  });
  await persistEventoV21({ db, evento: canonico });
}

function scheduleEventoTicketGlobal(db, solId, evtId, evento) {
  const tipoCfg = resolveTipoCfg(evento.tipo_evento);
  if (!tipoCfg) return;
  void (async () => {
    try {
      await persistEventoTicketGlobal(db, solId, evtId, evento, tipoCfg);
    } catch (err) {
      logger.warn("ticket_evento_global_failed", {
        sol_id: solId,
        evento_id: evtId,
        tipo_evento: evento.tipo_evento,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} solId
 * @param {object} evento
 * @param {{ writer?: import("firebase-admin/firestore").Transaction, syncGlobal?: boolean, failSilent?: boolean, evento_id?: string }} [opts]
 */
async function registrarEventoTicket(db, solId, evento, opts = {}) {
  const solIdTrim = String(solId || "").trim();
  if (!/^sol_[0-9A-HJKMNP-TV-Z]{26}$/i.test(solIdTrim)) {
    throw new Error("registrarEventoTicket: solId inválido");
  }
  const tipoEvento = String(evento?.tipo_evento || "").trim();
  const tipoCfg = resolveTipoCfg(tipoEvento);
  if (!tipoCfg) {
    throw new Error(`registrarEventoTicket: tipo_evento desconocido (${tipoEvento})`);
  }

  const evtId = String(opts.evento_id || evento.evento_id || "").trim() || `evt_${ulid()}`;
  const syncGlobal = opts.syncGlobal !== false;
  const doc = buildSubcolDocument(solIdTrim, evtId, evento, tipoCfg);
  const ref = subcolRef(db, solIdTrim, evtId);

  if (opts.writer && typeof opts.writer.set === "function") {
    opts.writer.set(ref, doc);
    return { evento_id: evtId, subcol_en_tx: true };
  }

  try {
    await ref.set(doc);
  } catch (err) {
    if (opts.failSilent === false) throw err;
    logger.warn("ticket_evento_subcol_failed", {
      sol_id: solIdTrim,
      evento_id: evtId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { evento_id: evtId, ok: false };
  }

  if (syncGlobal) {
    scheduleEventoTicketGlobal(db, solIdTrim, evtId, evento);
  }

  return { evento_id: evtId, ok: true };
}

/**
 * Reintento / post-tx: solo capa global con evtId ya usado en subcolección.
 */
async function registrarEventoTicketGlobalOnly(db, solId, evtId, evento, opts = {}) {
  const tipoCfg = resolveTipoCfg(evento.tipo_evento);
  if (!tipoCfg) return { evento_id: evtId, ok: false };
  try {
    await persistEventoTicketGlobal(db, solId, evtId, evento, tipoCfg);
    return { evento_id: evtId, ok: true };
  } catch (err) {
    if (opts.failSilent === false) throw err;
    logger.warn("ticket_evento_global_failed", {
      sol_id: solId,
      evento_id: evtId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { evento_id: evtId, ok: false };
  }
}

async function enrichEventoLabels(db, evento) {
  const out = { ...evento };
  const titularId = String(evento.titular_persona_id || evento.actor_persona_id || "").trim();
  const actorId = String(evento.actor_persona_id || "").trim();
  if (titularId) {
    const snap = await db.collection("personas").doc(titularId).get();
    if (snap.exists) out._persona_label = buildPersonaLabel(snap.data());
  }
  if (actorId && actorId !== titularId) {
    const snap = await db.collection("personas").doc(actorId).get();
    if (snap.exists) out._actor_label = buildPersonaLabel(snap.data());
  } else if (actorId) {
    out._actor_label = out._persona_label;
  }
  return out;
}

module.exports = {
  registrarEventoTicket,
  registrarEventoTicketGlobalOnly,
  scheduleEventoTicketGlobal,
  enrichEventoLabels,
  sanitizeMetadata,
};
