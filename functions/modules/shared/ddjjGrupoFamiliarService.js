"use strict";

const { ulid } = require("ulid");
const { HttpsError } = require("firebase-functions/v2/https");
const { buildEventoV21, persistEventoV21 } = require("./eventosV2");

function normalizeEventValue(value) {
  if (value == null) return null;
  if (value && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "__timestamp__";
    }
  }
  if (Array.isArray(value)) return value.map((item) => normalizeEventValue(item));
  if (typeof value === "object") {
    if (typeof value.isEqual === "function" && String(value).includes("FieldValue.serverTimestamp")) {
      return "__server_timestamp__";
    }
    if (Object.keys(value).length === 0) return "__server_timestamp__";
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeEventValue(v);
    return out;
  }
  return value;
}

function buildTopLevelChanges(prevData, nextData, keys) {
  const prev = prevData && typeof prevData === "object" ? prevData : {};
  const next = nextData && typeof nextData === "object" ? nextData : {};
  return keys
    .filter((key) => JSON.stringify(prev[key] ?? null) !== JSON.stringify(next[key] ?? null))
    .map((key) => ({
      campo: key,
      anterior: normalizeEventValue(prev[key] ?? null),
      nuevo: normalizeEventValue(next[key] ?? null),
    }));
}

async function processDdjjGrupoFamiliar({
  tx,
  db,
  colRaw,
  titularPersonaId,
  datos,
  now,
  toNullableTrimmedString,
  toNumberOrNull,
  assertDocExistsOrNull,
  actorPersonaId,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  DDJJ_ESTADO_PRESENTADA_ID,
  DDJJ_ESTADO_SUPERADA_ID,
  ESTADO_BANDEJA_RRHH_PENDIENTE_ID,
}) {
  await assertDocExistsOrNull("personas", titularPersonaId, "titular_persona_id");
  const familiaresInput = Array.isArray(datos.familiares) ? datos.familiares : [];
  if (!Array.isArray(familiaresInput) || familiaresInput.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-DDJJ-002] Debe informarse al menos un familiar en declaraciones_grupo_familiar.",
    );
  }
  const familiaresIncompletos = familiaresInput.some((f) => {
    const parentesco = toNullableTrimmedString(f && f.parentesco_id);
    const dni = toNullableTrimmedString(f && f.dni);
    const nombreF = toNullableTrimmedString(f && f.nombre);
    const apellidoF = toNullableTrimmedString(f && f.apellido);
    const fechaNac = toNullableTrimmedString(f && f.fecha_nacimiento);
    return !parentesco || !dni || !nombreF || !apellidoF || !fechaNac;
  });
  if (familiaresIncompletos) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-DDJJ-003] Cada familiar requiere: parentesco_id, dni, nombre, apellido y fecha_nacimiento.",
    );
  }
  const familiaresPayload = familiaresInput.map((f) => {
    const estadoAuditoriaId =
      toNullableTrimmedString(f && f.estado_auditoria_familiar_id) || "CFG_EAF_01_PENDIENTE";
    const motivoRechazoId = toNullableTrimmedString(f && f.motivo_rechazo_id);
    if (estadoAuditoriaId === "CFG_EAF_04_RECHAZADO" && !motivoRechazoId) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-DDJJ-004] Si el estado de auditoría del familiar es rechazado, motivo_rechazo_id es obligatorio.",
      );
    }
    return {
      ...f,
      familiar_id: toNullableTrimmedString(f && f.familiar_id) || `fam_${ulid()}`,
      estado_auditoria_familiar_id: "CFG_EAF_01_PENDIENTE",
      motivo_rechazo_id: null,
      motivo_rechazo_detalle: null,
      observacion_auditoria: null,
      auditado_en: null,
      auditado_por_persona_id: null,
    };
  });

  const incomingId = toNullableTrimmedString(datos.id);
  const incomingVersion = toNumberOrNull(datos.declaracion_version);
  const incomingAceptada = datos.declaracion_jurada_aceptada === true;
  const incomingConsentEval = datos.consentimiento_evaluacion_rrhh === true;
  const incomingPresentada = incomingAceptada && incomingConsentEval;

  const byTitularQuery = db.collection(colRaw).where("titular_persona_id", "==", titularPersonaId);
  const byTitularSnap = await tx.get(byTitularQuery);
  const docs = byTitularSnap.docs || [];

  const explicitDoc = incomingId ? docs.find((dDoc) => String(dDoc.id || "").trim() === incomingId) : null;
  const maxVersion = docs.reduce((maxV, dDoc) => {
    const n = toNumberOrNull(dDoc.get("declaracion_version"));
    return n != null && n > maxV ? n : maxV;
  }, 0);
  const sorted = [...docs].sort((a, b) => {
    const va = toNumberOrNull(a.get("declaracion_version")) || 0;
    const vb = toNumberOrNull(b.get("declaracion_version")) || 0;
    if (vb !== va) return vb - va;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
  const latest = sorted[0] || null;
  const latestPresentada =
    sorted.find((dDoc) => toNullableTrimmedString(dDoc.get("estado_declaracion_id")) === DDJJ_ESTADO_PRESENTADA_ID) ||
    null;

  let targetDoc = explicitDoc;
  let declaracionVersion = incomingVersion;

  if (!targetDoc && declaracionVersion != null) {
    targetDoc =
      docs.find((dDoc) => (toNumberOrNull(dDoc.get("declaracion_version")) || 0) === declaracionVersion) || null;
  }
  if (!targetDoc && incomingPresentada === true) {
    declaracionVersion = declaracionVersion || Math.max(1, maxVersion + 1);
    const deterministicId = `gf_${titularPersonaId}_v${declaracionVersion}`;
    targetDoc = { id: deterministicId };
  }
  if (!targetDoc) {
    const latestEstado = toNullableTrimmedString(latest && latest.get("estado_declaracion_id"));
    const latestVersion = toNumberOrNull(latest && latest.get("declaracion_version")) || 0;
    const latestEsEditable = latest && latestEstado !== DDJJ_ESTADO_PRESENTADA_ID;
    if (latestEsEditable) {
      targetDoc = latest;
      declaracionVersion = latestVersion || 1;
    } else {
      declaracionVersion = declaracionVersion || Math.max(1, maxVersion + 1);
      const deterministicId = `gf_${titularPersonaId}_v${declaracionVersion}`;
      targetDoc = { id: deterministicId };
    }
  }

  const ref = db.collection(colRaw).doc(targetDoc.id);
  const existing = await tx.get(ref);
  const exists = existing.exists;
  if (declaracionVersion == null) declaracionVersion = toNumberOrNull(existing.get("declaracion_version")) || 1;

  const existingEstado = exists
    ? toNullableTrimmedString(existing.get("estado_declaracion_id")) || ESTADO_DDJJ_DEFAULT_PERSONALES
    : ESTADO_DDJJ_DEFAULT_PERSONALES;
  const estadoDeclaracionId = incomingPresentada ? DDJJ_ESTADO_PRESENTADA_ID : existingEstado;
  const declaracionJuradaAceptada = exists
    ? existing.get("declaracion_jurada_aceptada") === true || incomingPresentada
    : incomingPresentada;
  const consentimientoEvaluacionRrhh = exists
    ? existing.get("consentimiento_evaluacion_rrhh") === true || incomingPresentada
    : incomingPresentada;
  const aceptadaEn =
    declaracionJuradaAceptada === true
      ? exists && existing.get("aceptada_en")
        ? existing.get("aceptada_en")
        : now
      : null;

  const payload = {
    id: targetDoc.id,
    titular_persona_id: titularPersonaId,
    declaracion_version: declaracionVersion,
    estado_declaracion_id: estadoDeclaracionId,
    declaracion_jurada_aceptada: declaracionJuradaAceptada,
    consentimiento_evaluacion_rrhh: consentimientoEvaluacionRrhh,
    aceptada_en: aceptadaEn,
    familiares: familiaresPayload,
    actualizado_en: now,
    schema_version: 1,
  };
  if (!exists) payload.creado_en = now;
  tx.set(ref, payload, { merge: true });

  const cambios = buildTopLevelChanges(existing.data() || {}, payload, [
    "titular_persona_id",
    "declaracion_version",
    "estado_declaracion_id",
    "declaracion_jurada_aceptada",
    "consentimiento_evaluacion_rrhh",
    "aceptada_en",
    "familiares",
  ]);
  const cambiosResumen = cambios.filter((c) => c.campo !== "familiares");
  const shouldEmitEventoRrhh = incomingPresentada === true && (!exists || cambios.length > 0);
  if (shouldEmitEventoRrhh) {
    const currentVersion = toNumberOrNull(payload.declaracion_version) || 0;
    const prevVersion = toNumberOrNull(latestPresentada && latestPresentada.get("declaracion_version")) || 0;
    const isActualizacion = prevVersion > 0 && currentVersion > prevVersion;
    if (isActualizacion && latestPresentada && latestPresentada.id !== targetDoc.id) {
      tx.set(
        db.collection(colRaw).doc(latestPresentada.id),
        {
          estado_declaracion_id: DDJJ_ESTADO_SUPERADA_ID,
          reemplazada_por_ddjj_id: targetDoc.id,
          reemplazada_por_version: currentVersion,
          reemplazada_en: now,
          actualizado_en: now,
        },
        { merge: true },
      );
    }
    const eventoId = `evt_${ulid()}`;
    persistEventoV21({
      db,
      writer: tx,
      evento: buildEventoV21({
        id: eventoId,
        tipo_evento_id: "cfg_tev_ddjj",
        modulo_origen: "datos_personales",
        accion: isActualizacion
          ? "presentar_ddjj_grupo_familiar_actualizacion"
          : "presentar_ddjj_grupo_familiar_inicial",
        persona_id: titularPersonaId,
        actor_persona_id: actorPersonaId || null,
        payload_ui: {
          titulo: isActualizacion ? "DDJJ actualizada y presentada" : "DDJJ presentada",
          resumen: "Se registro una presentacion de DDJJ de grupo familiar para revision RRHH.",
          entidad: "declaraciones_grupo_familiar",
          persona_afectada_label: titularPersonaId,
          actor_label: actorPersonaId || "Sistema",
        },
        payload_contexto: {
          estado_bandeja_rrhh_id: ESTADO_BANDEJA_RRHH_PENDIENTE_ID,
          declaracion_presentada: true,
          declaracion_version: currentVersion || null,
          familiares_count: Array.isArray(payload.familiares) ? payload.familiares.length : 0,
          familiares_count_anterior: Array.isArray(existing.get("familiares")) ? existing.get("familiares").length : 0,
          version_anterior_superada: isActualizacion ? prevVersion : null,
          ddjj_id: targetDoc.id,
        },
        payload_cambios: cambiosResumen.map((c) => ({
          campo: c.campo,
          label: c.campo,
          antes: c.anterior ?? null,
          despues: c.nuevo ?? null,
          antes_label: c.anterior ?? null,
          despues_label: c.nuevo ?? null,
          tipo: "string",
        })),
      }),
    });
  }

  return { id: targetDoc.id };
}

module.exports = {
  processDdjjGrupoFamiliar,
};
