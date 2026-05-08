"use strict";

const { FieldValue } = require("./context");
const {
  COL_EVENTOS,
  COL_EVENTOS_BANDEJA_RRHH,
  COL_EVENTOS_POR_PERSONA,
  COL_EVENTOS_POR_MODULO,
} = require("./constants");

const EVENT_SCHEMA_VERSION = "eventos_v2_1";

function formatPeriodoYyyymm(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function buildPersonaLabel(persona) {
  if (!persona || typeof persona !== "object") return "Persona no identificada";
  const apellido = typeof persona.apellido === "string" ? persona.apellido.trim() : "";
  const nombre = typeof persona.nombre === "string" ? persona.nombre.trim() : "";
  const dni = typeof persona.dni === "string" ? persona.dni.trim() : "";
  const fullName = [apellido, nombre].filter(Boolean).join(", ");
  if (fullName && dni) return `${fullName} · DNI ${dni}`;
  if (fullName) return fullName;
  if (dni) return `DNI ${dni}`;
  return "Persona no identificada";
}

function normalizeCambios(cambios) {
  if (!Array.isArray(cambios)) return [];
  return cambios.map((item) => ({
    campo: item?.campo ?? null,
    label: item?.label ?? null,
    antes: item?.antes ?? null,
    despues: item?.despues ?? null,
    antes_label: item?.antes_label ?? null,
    despues_label: item?.despues_label ?? null,
    tipo: item?.tipo ?? "string",
  }));
}

function buildEventoV21({
  id,
  tipo_evento_id,
  modulo_origen,
  accion,
  persona_id = null,
  actor_uid = null,
  actor_persona_id = null,
  payload_ui,
  payload_contexto = {},
  payload_cambios = [],
}) {
  return {
    id,
    tipo_evento_id,
    modulo_origen,
    accion,
    persona_id,
    actor_uid,
    actor_persona_id,
    ocurrido_en: FieldValue.serverTimestamp(),
    periodo_yyyymm: formatPeriodoYyyymm(),
    schema_version: EVENT_SCHEMA_VERSION,
    payload: {
      ui: payload_ui,
      contexto: payload_contexto,
      cambios: normalizeCambios(payload_cambios),
    },
  };
}

function buildBandejaRrhhProjection(evento) {
  const periodo = evento.periodo_yyyymm || formatPeriodoYyyymm();
  const estadoBandeja =
    (evento.payload &&
      evento.payload.contexto &&
      typeof evento.payload.contexto.estado_bandeja_rrhh_id === "string" &&
      evento.payload.contexto.estado_bandeja_rrhh_id) ||
    "cfg_ebr_pend_rev";
  const projectionId = evento.id;
  return {
    id: projectionId,
    evento_id: evento.id,
    ocurrido_en: evento.ocurrido_en,
    periodo_yyyymm: periodo,
    modulo_origen: evento.modulo_origen || null,
    accion: evento.accion || null,
    tipo_evento_id: evento.tipo_evento_id || null,
    persona_id: evento.persona_id || null,
    actor_persona_id: evento.actor_persona_id || null,
    estado_bandeja_rrhh_id: estadoBandeja,
    ui_titulo: evento.payload && evento.payload.ui ? evento.payload.ui.titulo || null : null,
    ui_resumen: evento.payload && evento.payload.ui ? evento.payload.ui.resumen || null : null,
    entidad_tipo: evento.payload && evento.payload.ui ? evento.payload.ui.entidad || null : null,
    entidad_id: evento.payload && evento.payload.contexto ? evento.payload.contexto.id || null : null,
    actor_uid: evento.actor_uid || null,
    payload: evento.payload || null,
    schema_version: EVENT_SCHEMA_VERSION,
  };
}

function buildEventoPorPersonaProjection(evento) {
  const periodo = evento.periodo_yyyymm || formatPeriodoYyyymm();
  const projectionId = evento.persona_id ? `${evento.persona_id}_${evento.id}` : evento.id;
  return {
    id: projectionId,
    evento_id: evento.id,
    ocurrido_en: evento.ocurrido_en,
    periodo_yyyymm: periodo,
    modulo_origen: evento.modulo_origen || null,
    accion: evento.accion || null,
    tipo_evento_id: evento.tipo_evento_id || null,
    persona_id: evento.persona_id || null,
    actor_persona_id: evento.actor_persona_id || null,
    ui_titulo: evento.payload && evento.payload.ui ? evento.payload.ui.titulo || null : null,
    ui_resumen: evento.payload && evento.payload.ui ? evento.payload.ui.resumen || null : null,
    entidad_tipo: evento.payload && evento.payload.ui ? evento.payload.ui.entidad || null : null,
    entidad_id: evento.payload && evento.payload.contexto ? evento.payload.contexto.id || null : null,
    actor_uid: evento.actor_uid || null,
    payload: evento.payload || null,
    schema_version: EVENT_SCHEMA_VERSION,
  };
}

function buildEventoPorModuloProjection(evento) {
  const periodo = evento.periodo_yyyymm || formatPeriodoYyyymm();
  const projectionId = evento.modulo_origen ? `${evento.modulo_origen}_${evento.id}` : evento.id;
  return {
    id: projectionId,
    evento_id: evento.id,
    ocurrido_en: evento.ocurrido_en,
    periodo_yyyymm: periodo,
    modulo_origen: evento.modulo_origen || null,
    accion: evento.accion || null,
    tipo_evento_id: evento.tipo_evento_id || null,
    persona_id: evento.persona_id || null,
    actor_persona_id: evento.actor_persona_id || null,
    ui_titulo: evento.payload && evento.payload.ui ? evento.payload.ui.titulo || null : null,
    ui_resumen: evento.payload && evento.payload.ui ? evento.payload.ui.resumen || null : null,
    entidad_tipo: evento.payload && evento.payload.ui ? evento.payload.ui.entidad || null : null,
    entidad_id: evento.payload && evento.payload.contexto ? evento.payload.contexto.id || null : null,
    actor_uid: evento.actor_uid || null,
    payload: evento.payload || null,
    schema_version: EVENT_SCHEMA_VERSION,
  };
}

async function persistEventoV21({ db, evento, writer }) {
  const eventoRef = db.collection(COL_EVENTOS).doc(evento.id);
  const bandeja = buildBandejaRrhhProjection(evento);
  const bandejaRef = db.collection(COL_EVENTOS_BANDEJA_RRHH).doc(bandeja.id);
  const porPersona = buildEventoPorPersonaProjection(evento);
  const porPersonaRef = db.collection(COL_EVENTOS_POR_PERSONA).doc(porPersona.id);
  const porModulo = buildEventoPorModuloProjection(evento);
  const porModuloRef = db.collection(COL_EVENTOS_POR_MODULO).doc(porModulo.id);
  if (writer && typeof writer.set === "function") {
    writer.set(eventoRef, evento, { merge: true });
    writer.set(bandejaRef, bandeja, { merge: true });
    writer.set(porPersonaRef, porPersona, { merge: true });
    writer.set(porModuloRef, porModulo, { merge: true });
    return;
  }
  await Promise.all([
    eventoRef.set(evento, { merge: true }),
    bandejaRef.set(bandeja, { merge: true }),
    porPersonaRef.set(porPersona, { merge: true }),
    porModuloRef.set(porModulo, { merge: true }),
  ]);
}

module.exports = {
  EVENT_SCHEMA_VERSION,
  formatPeriodoYyyymm,
  buildPersonaLabel,
  buildEventoV21,
  buildBandejaRrhhProjection,
  buildEventoPorPersonaProjection,
  buildEventoPorModuloProjection,
  persistEventoV21,
};

