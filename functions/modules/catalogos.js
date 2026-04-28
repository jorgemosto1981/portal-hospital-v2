"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("../../shared/runtimeFlags.json");
const {
  assertColeccionOnboardingLectura,
  assertColeccionRrhh,
  assertRrhh,
  normalizeCatalogDocId,
  serializeFirestoreValue,
  toTimestampOrNull,
} = require("./shared/helpers");

const listarColeccion = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertRrhh(request);
  }
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  return { items };
});

const guardarOpcion = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertRrhh(request);
  }
  const col = assertColeccionRrhh(request.data && request.data.collectionName);
  const datos =
    request.data && request.data.datos && typeof request.data.datos === "object" ? request.data.datos : {};
  const id =
    col === "grupos_de_trabajo"
      ? normalizeGrupoTrabajoIdV2(datos.id)
      : normalizeCatalogDocId(datos.id);
  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) {
    throw new (require("firebase-functions/v2/https").HttpsError)("invalid-argument", "El nombre es obligatorio.");
  }
  const activo = datos.activo !== false;
  const ref = db.collection(col).doc(id);
  const exists = (await ref.get()).exists;
  const payload = { id, nombre, activo, actualizado_en: FieldValue.serverTimestamp() };
  if ("vigente_desde" in datos) {
    payload.vigente_desde =
      datos.vigente_desde == null || datos.vigente_desde === "" ? null : toTimestampOrNull(datos.vigente_desde);
  }
  if ("vigente_hasta" in datos) {
    payload.vigente_hasta =
      datos.vigente_hasta == null || datos.vigente_hasta === "" ? null : toTimestampOrNull(datos.vigente_hasta);
  }
  if (!exists) payload.creado_en = FieldValue.serverTimestamp();
  if (col === "cfg_localidad" && "provincia_id" in datos) {
    const raw = datos.provincia_id;
    payload.provincia_id = raw == null || raw === "" ? null : normalizeCatalogDocId(String(raw));
  }
  await ref.set(payload, { merge: true });
  return { ok: true, id };
});

const listarCatalogoOnboarding = onCall(async (request) => {
  if (!request.auth) {
    throw new (require("firebase-functions/v2/https").HttpsError)("unauthenticated", "Se requiere sesión.");
  }
  const col = assertColeccionOnboardingLectura(request.data && request.data.collectionName);
  const snap = await db.collection(col).get();
  const items = snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      if (Object.hasOwn(data, "activo") && data.activo === false) return null;
      const flat = serializeFirestoreValue(data);
      const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
      return { ...base, id: doc.id };
    })
    .filter(Boolean);
  return { items };
});

const COLECCIONES_PUBLICAS_TEMPORALES = new Set([
  "grupos_de_trabajo",
  "cfg_efectores",
  "historial_laboral_cargos",
  "historial_laboral_datos",
  "historial_laboral_grupos",
  "personas",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
  "cfg_estado_civil",
  "cfg_nacionalidad",
  "cfg_sexo_genero",
  "cfg_provincia",
  "cfg_localidad",
  "cfg_nivel_estudios",
  "cfg_parentesco",
  "cfg_estado_perfil_datos",
  "cfg_estado_asignacion_laboral",
  "cfg_escalafon",
  "cfg_agrupamiento",
  "cfg_categorias",
  "cfg_cargo_funcional",
  "cfg_rol",
  "cfg_estado_declaracion_ddjj",
  "cfg_tipo_consentimiento",
  "cfg_textos_legales",
  "cfg_idioma",
]);

const COLECCIONES_ESCRITURA_LABORAL_TEMPORAL = new Set([
  "historial_laboral_cargos",
  "historial_laboral_datos",
  "historial_laboral_grupos",
]);

const COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL = new Set([
  "personas",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
]);
const ESTADO_DDJJ_DEFAULT_PERSONALES = "CFG_DDJJ_03_PRESENTADA";
const ESTADO_PERFIL_DEFAULT_PERSONAS = "cfg_epd_inc";
const ESTADO_PERFIL_FALLBACK_PERSONAS = "cfg_epd_borr";
const RX_GDT_ID_V2 = /^gdt_[0-9A-HJKMNP-TV-Z]{26}$/;
const RX_GDT_ID_LEGACY = /^GT_[A-Z0-9_]+$/;

function normalizeGrupoTrabajoIdV2(id) {
  const raw = toNullableTrimmedString(id);
  if (!raw) {
    throw new HttpsError("invalid-argument", "El id es obligatorio.");
  }
  // Compatibilidad temporal: permite editar legacy GT_* ya existentes.
  if (RX_GDT_ID_LEGACY.test(raw)) {
    return raw;
  }
  if (!RX_GDT_ID_V2.test(raw)) {
    throw new HttpsError(
      "invalid-argument",
      "ID inválido para grupos_de_trabajo. Regla V2: gdt_<ULID> (ej: gdt_01H...).",
    );
  }
  return raw;
}

function toNullableTrimmedString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toNumberOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function assertDocExistsOrNull(collectionName, docId, label) {
  if (!docId) return;
  const snap = await db.collection(collectionName).doc(docId).get();
  if (!snap.exists) {
    throw new HttpsError("invalid-argument", `${label} inválido o inexistente: ${docId}`);
  }
}

async function resolveEstadoPerfilDatosIdDefault(rawEstadoPerfilId) {
  const incoming = toNullableTrimmedString(rawEstadoPerfilId);
  if (incoming) {
    await assertDocExistsOrNull("cfg_estado_perfil_datos", incoming, "estado_perfil_datos_id");
    return incoming;
  }
  const preferredSnap = await db.collection("cfg_estado_perfil_datos").doc(ESTADO_PERFIL_DEFAULT_PERSONAS).get();
  if (preferredSnap.exists) return ESTADO_PERFIL_DEFAULT_PERSONAS;
  const fallbackSnap = await db
    .collection("cfg_estado_perfil_datos")
    .doc(ESTADO_PERFIL_FALLBACK_PERSONAS)
    .get();
  if (fallbackSnap.exists) return ESTADO_PERFIL_FALLBACK_PERSONAS;
  throw new HttpsError(
    "failed-precondition",
    "Falta seed de cfg_estado_perfil_datos (esperado: cfg_epd_inc o cfg_epd_borr).",
  );
}

/**
 * Callable temporal sin auth para desbloquear navegación web mientras se estabilizan Rules.
 * Limitar estrictamente a colecciones laborales de lectura.
 */
const listarColeccionPublicaTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    throw new HttpsError("permission-denied", "Acceso temporal deshabilitado.");
  }
  const colRaw = request.data && request.data.collectionName;
  if (typeof colRaw !== "string" || !COLECCIONES_PUBLICAS_TEMPORALES.has(colRaw.trim())) {
    throw new HttpsError("invalid-argument", "Colección no permitida en acceso temporal.");
  }
  const col = colRaw.trim();
  const snap = await db.collection(col).get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    const flat = serializeFirestoreValue(data);
    const base = typeof flat === "object" && flat !== null && !Array.isArray(flat) ? flat : {};
    return { ...base, id: doc.id };
  });
  return { items };
});

const guardarRegistroLaboralTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertRrhh(request);
  }
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const colRaw = typeof d.collectionName === "string" ? d.collectionName.trim() : "";
  if (!COLECCIONES_ESCRITURA_LABORAL_TEMPORAL.has(colRaw)) {
    throw new HttpsError("invalid-argument", "Colección laboral no permitida para escritura temporal.");
  }
  const datos = d.datos && typeof d.datos === "object" ? d.datos : {};
  const now = FieldValue.serverTimestamp();

  if (colRaw === "historial_laboral_cargos") {
    const id = toNullableTrimmedString(datos.id) || `hlc_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    const efDesignacionId = toNullableTrimmedString(datos.efector_designacion_id);
    const efCumplimientoId = toNullableTrimmedString(datos.efector_cumplimiento_id);
    if (!personaId || !efDesignacionId || !efCumplimientoId) {
      throw new HttpsError(
        "invalid-argument",
        "En HLc son obligatorios: persona_id, efector_designacion_id y efector_cumplimiento_id.",
      );
    }
    await assertDocExistsOrNull("cfg_efectores", efDesignacionId, "efector_designacion_id");
    await assertDocExistsOrNull("cfg_efectores", efCumplimientoId, "efector_cumplimiento_id");
    const payload = {
      id,
      persona_id: personaId,
      efector_designacion_id: efDesignacionId,
      efector_cumplimiento_id: efCumplimientoId,
      escalafon_id: toNullableTrimmedString(datos.escalafon_id),
      agrupamiento_id: toNullableTrimmedString(datos.agrupamiento_id),
      categoria_id: toNullableTrimmedString(datos.categoria_id),
      cargo_funcional_id: toNullableTrimmedString(datos.cargo_funcional_id),
      estado_asignacion_id: toNullableTrimmedString(datos.estado_asignacion_id),
      carga_horaria_total: toNumberOrNull(datos.carga_horaria_total),
      fecha_desde: toNullableTrimmedString(datos.fecha_desde),
      fecha_hasta: toNullableTrimmedString(datos.fecha_hasta),
      activo: datos.activo !== false,
      actualizado_en: now,
    };
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  if (colRaw === "historial_laboral_datos") {
    const id = toNullableTrimmedString(datos.id) || `hld_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    const cargoId = toNullableTrimmedString(datos.cargo_id);
    if (!personaId || !cargoId) {
      throw new HttpsError("invalid-argument", "En HLd son obligatorios: persona_id y cargo_id.");
    }
    await assertDocExistsOrNull("historial_laboral_cargos", cargoId, "cargo_id");
    const cargoSnap = await db.collection("historial_laboral_cargos").doc(cargoId).get();
    const cargoPersonaId = toNullableTrimmedString(cargoSnap.get("persona_id"));
    if (cargoPersonaId && cargoPersonaId !== personaId) {
      throw new HttpsError(
        "invalid-argument",
        `persona_id inconsistente: HLd (${personaId}) no coincide con HLc (${cargoPersonaId}).`,
      );
    }
    const payload = {
      id,
      persona_id: personaId,
      cargo_id: cargoId,
      rol_id: toNullableTrimmedString(datos.rol_id),
      escalafon_id: toNullableTrimmedString(datos.escalafon_id),
      agrupamiento_id: toNullableTrimmedString(datos.agrupamiento_id),
      funcion_real_id: toNullableTrimmedString(datos.funcion_real_id),
      nivel_jerarquico: toNumberOrNull(datos.nivel_jerarquico),
      fecha_inicio: toNullableTrimmedString(datos.fecha_inicio),
      fecha_fin: toNullableTrimmedString(datos.fecha_fin),
      activo: datos.activo !== false,
      actualizado_en: now,
    };
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  const id = toNullableTrimmedString(datos.id) || `hlg_${ulid()}`;
  const personaId = toNullableTrimmedString(datos.persona_id);
  const datoLaboralId = toNullableTrimmedString(datos.dato_laboral_id);
  const grupoId = toNullableTrimmedString(datos.grupo_de_trabajo_id);
  if (!personaId || !datoLaboralId || !grupoId) {
    throw new HttpsError(
      "invalid-argument",
      "En HLg son obligatorios: persona_id, dato_laboral_id y grupo_de_trabajo_id.",
    );
  }
  await assertDocExistsOrNull("historial_laboral_datos", datoLaboralId, "dato_laboral_id");
  const datoSnap = await db.collection("historial_laboral_datos").doc(datoLaboralId).get();
  const datoPersonaId = toNullableTrimmedString(datoSnap.get("persona_id"));
  if (datoPersonaId && datoPersonaId !== personaId) {
    throw new HttpsError(
      "invalid-argument",
      `persona_id inconsistente: HLg (${personaId}) no coincide con HLd (${datoPersonaId}).`,
    );
  }
  await assertDocExistsOrNull("grupos_de_trabajo", grupoId, "grupo_de_trabajo_id");
  const carga = Array.isArray(datos.carga_por_dia_semana)
    ? datos.carga_por_dia_semana.map((x) => toNumberOrNull(x))
    : [];
  const payload = {
    id,
    persona_id: personaId,
    dato_laboral_id: datoLaboralId,
    grupo_de_trabajo_id: grupoId,
    nivel_jerarquico: toNumberOrNull(datos.nivel_jerarquico),
    carga_por_dia_semana: carga,
    fecha_inicio: toNullableTrimmedString(datos.fecha_inicio),
    fecha_fin: toNullableTrimmedString(datos.fecha_fin),
    activo: datos.activo !== false,
    actualizado_en: now,
  };
  const ref = db.collection(colRaw).doc(id);
  const exists = (await ref.get()).exists;
  if (!exists) payload.creado_en = now;
  await ref.set(payload, { merge: true });
  return { ok: true, id };
});

const guardarRegistroPersonalTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) {
    assertRrhh(request);
  }
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const colRaw = typeof d.collectionName === "string" ? d.collectionName.trim() : "";
  if (!COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL.has(colRaw)) {
    throw new HttpsError("invalid-argument", "Colección personal no permitida para escritura temporal.");
  }
  const datos = d.datos && typeof d.datos === "object" ? d.datos : {};
  const now = FieldValue.serverTimestamp();

  if (colRaw === "personas") {
    const id = toNullableTrimmedString(datos.id) || `per_${ulid()}`;
    const dni = toNullableTrimmedString(datos.dni);
    const nombre = toNullableTrimmedString(datos.nombre);
    const apellido = toNullableTrimmedString(datos.apellido);
    if (!dni || !nombre || !apellido) {
      throw new HttpsError("invalid-argument", "En personas son obligatorios: dni, nombre y apellido.");
    }
    const estadoPerfilDatosId = await resolveEstadoPerfilDatosIdDefault(datos.estado_perfil_datos_id);
    const payload = {
      persona_id: id,
      dni,
      nombre,
      apellido,
      cuil: toNullableTrimmedString(datos.cuil),
      fecha_nacimiento: toNullableTrimmedString(datos.fecha_nacimiento),
      sexo_genero_id: toNullableTrimmedString(datos.sexo_genero_id),
      estado_civil_id: toNullableTrimmedString(datos.estado_civil_id),
      nacionalidad_id: toNullableTrimmedString(datos.nacionalidad_id),
      contacto: datos.contacto && typeof datos.contacto === "object" ? datos.contacto : {},
      domicilio: datos.domicilio && typeof datos.domicilio === "object" ? datos.domicilio : {},
      estado_perfil_datos_id: estadoPerfilDatosId,
      perfil_completitud_version: toNumberOrNull(datos.perfil_completitud_version) || 1,
      activo: datos.activo !== false,
      actualizado_en: now,
      schema_version: 1,
    };
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  if (colRaw === "formacion_agente") {
    const id = toNullableTrimmedString(datos.id) || `for_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    if (!personaId) throw new HttpsError("invalid-argument", "En formacion_agente es obligatorio: persona_id.");
    await assertDocExistsOrNull("personas", personaId, "persona_id");
    const payload = {
      id,
      persona_id: personaId,
      nivel_estudios_id: toNullableTrimmedString(datos.nivel_estudios_id),
      titulo_completo: toNullableTrimmedString(datos.titulo_completo),
      duracion_anios: toNumberOrNull(datos.duracion_anios),
      institucion: toNullableTrimmedString(datos.institucion),
      activo: datos.activo !== false,
      actualizado_en: now,
      schema_version: 1,
    };
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  if (colRaw === "declaraciones_grupo_familiar") {
    const id = toNullableTrimmedString(datos.id) || `gf_${ulid()}`;
    const titularPersonaId = toNullableTrimmedString(datos.titular_persona_id);
    if (!titularPersonaId) {
      throw new HttpsError("invalid-argument", "En declaraciones_grupo_familiar es obligatorio: titular_persona_id.");
    }
    await assertDocExistsOrNull("personas", titularPersonaId, "titular_persona_id");
    const ref = db.collection(colRaw).doc(id);
    const existing = await ref.get();
    const isNew = !existing.exists;
    let declaracionVersion = toNumberOrNull(datos.declaracion_version);
    if (declaracionVersion == null) {
      if (isNew) {
        const prevSnap = await db
          .collection(colRaw)
          .where("titular_persona_id", "==", titularPersonaId)
          .get();
        const prev = prevSnap.empty
          ? null
          : prevSnap.docs.reduce((maxV, doc) => {
              const n = toNumberOrNull(doc.get("declaracion_version"));
              return n != null && n > maxV ? n : maxV;
            }, 0);
        declaracionVersion = (prev || 0) + 1;
      } else {
        declaracionVersion = toNumberOrNull(existing.get("declaracion_version")) || 1;
      }
    }
    const estadoDeclaracionId = existing.exists
      ? toNullableTrimmedString(existing.get("estado_declaracion_id")) || ESTADO_DDJJ_DEFAULT_PERSONALES
      : ESTADO_DDJJ_DEFAULT_PERSONALES;
    await assertDocExistsOrNull(
      "cfg_estado_declaracion_ddjj",
      estadoDeclaracionId,
      "estado_declaracion_id",
    );
    const payload = {
      id,
      titular_persona_id: titularPersonaId,
      declaracion_version: declaracionVersion,
      estado_declaracion_id: estadoDeclaracionId,
      declaracion_jurada_aceptada: existing.exists
        ? existing.get("declaracion_jurada_aceptada") === true
        : false,
      aceptada_en: existing.exists ? existing.get("aceptada_en") || null : null,
      familiares: Array.isArray(datos.familiares) ? datos.familiares : [],
      actualizado_en: now,
      schema_version: 1,
    };
    if (!existing.exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id };
  }

  const id = toNullableTrimmedString(datos.id) || `doc_${ulid()}`;
  const personaId = toNullableTrimmedString(datos.persona_id);
  if (!personaId) throw new HttpsError("invalid-argument", "En consentimientos es obligatorio: persona_id.");
  await assertDocExistsOrNull("personas", personaId, "persona_id");
  await assertDocExistsOrNull(
    "cfg_tipo_consentimiento",
    toNullableTrimmedString(datos.tipo_consentimiento_id),
    "tipo_consentimiento_id",
  );
  await assertDocExistsOrNull("cfg_textos_legales", toNullableTrimmedString(datos.version_id), "version_id");
  await assertDocExistsOrNull("cfg_idioma", toNullableTrimmedString(datos.idioma_id), "idioma_id");
  const aceptado = datos.aceptado === true;
  const versionId = toNullableTrimmedString(datos.version_id);
  const payload = {
    id,
    persona_id: personaId,
    tipo_consentimiento_id: toNullableTrimmedString(datos.tipo_consentimiento_id),
    version_id: versionId,
    idioma_id: toNullableTrimmedString(datos.idioma_id),
    texto_hash: toNullableTrimmedString(datos.texto_hash) || (versionId ? `pending_${versionId}` : "pending"),
    aceptado,
    // Etapa base: si no está aceptado, no se persiste timestamp de aceptación.
    aceptado_en: aceptado ? toNullableTrimmedString(datos.aceptado_en) : null,
    actualizado_en: now,
    schema_version: 1,
  };
  const ref = db.collection(colRaw).doc(id);
  const exists = (await ref.get()).exists;
  if (!exists) payload.creado_en = now;
  await ref.set(payload, { merge: true });
  return { ok: true, id };
});

module.exports = {
  listarColeccion,
  guardarOpcion,
  listarCatalogoOnboarding,
  listarColeccionPublicaTemporal,
  guardarRegistroLaboralTemporal,
  guardarRegistroPersonalTemporal,
};

