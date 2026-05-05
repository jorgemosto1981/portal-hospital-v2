"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { createHash } = require("node:crypto");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("./shared/runtimeFlags.json");
const { assertRrhh, tokenHasRrhhAccess } = require("./shared/helpers");
const { processDdjjGrupoFamiliar } = require("./shared/ddjjGrupoFamiliarService");
const {
  COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL,
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  toNullableTrimmedString,
  toNumberOrNull,
  assertDocExistsOrNull,
  resolveEstadoPerfilDatosIdDefault,
  assertConsistenciaEstadoPerfilCuenta,
  pushWarning,
} = require("./catalogosShared");

const MSG_PERSONAS_SENSIBLE_ROL =
  "[AUTH-PER-001] Campo no editable por rol: solo RRHH puede modificar dni, nombre, apellido, activo y motivo_baja_id.";
const ESTADO_BANDEJA_RRHH_PENDIENTE_ID = "cfg_ebr_pend_rev";
const ESTADO_BANDEJA_RRHH_VISTO_ID = "cfg_ebr_visto";
const DDJJ_ESTADO_PRESENTADA_ID = "CFG_DDJJ_03_PRESENTADA";
const DDJJ_ESTADO_SUPERADA_ID = "CFG_DDJJ_04_SUPERADA_POR_ACTUALIZACION";
const EVENTO_CFG_ID_POR_EVENTO_ID = {
  EVT_LOGIN: "cfg_tev_login",
  EVT_DATOS_NOTIF_CAMBIO_DDJJ: "cfg_tev_datos_notif_cambio_ddjj",
  EVT_DATOS_ACTUALIZA_PERSONAS: "cfg_tev_datos_actualiza_personas",
  EVT_DATOS_ALTA_PERSONAS: "cfg_tev_datos_alta_personas",
  EVT_DATOS_ACTUALIZA_FORMACION: "cfg_tev_datos_actualiza_formacion",
  EVT_DATOS_ALTA_FORMACION: "cfg_tev_datos_alta_formacion",
  EVT_DATOS_ACTUALIZA_DDJJ: "cfg_tev_datos_actualiza_ddjj",
  EVT_DATOS_ALTA_DDJJ: "cfg_tev_datos_alta_ddjj",
  EVT_DATOS_ACTUALIZA_CONSENTIMIENTO: "cfg_tev_datos_actualiza_consentimiento",
  EVT_DATOS_ALTA_CONSENTIMIENTO: "cfg_tev_datos_alta_consentimiento",
  EVT_CONSENTIMIENTO_ACEPTADO: "cfg_tev_consent",
};

function isRrhhActor(request) {
  const token = request && request.auth && request.auth.token;
  return tokenHasRrhhAccess(token);
}

function getActorPersonaId(request) {
  const pid = request && request.auth && request.auth.token && request.auth.token.persona_id;
  return typeof pid === "string" && pid.trim() ? pid.trim() : null;
}

function resolveTipoEventoCfgId(tipoEventoId) {
  const key = typeof tipoEventoId === "string" ? tipoEventoId.trim().toUpperCase() : "";
  return EVENTO_CFG_ID_POR_EVENTO_ID[key] || "cfg_tev_datos_notif_cambio_generico";
}

function hasSensitivePersonaMutation({ existing, incoming }) {
  if (!existing) return false;
  const normalizeBool = (v, fallbackTrue = true) => (v === false ? false : fallbackTrue ? true : false);
  const pairs = [
    [toNullableTrimmedString(existing.dni), toNullableTrimmedString(incoming.dni)],
    [toNullableTrimmedString(existing.nombre), toNullableTrimmedString(incoming.nombre)],
    [toNullableTrimmedString(existing.apellido), toNullableTrimmedString(incoming.apellido)],
    [normalizeBool(existing.activo), normalizeBool(incoming.activo)],
    [toNullableTrimmedString(existing.motivo_baja_id), toNullableTrimmedString(incoming.motivo_baja_id)],
  ];
  return pairs.some(([prev, next]) => prev !== next);
}

function buildPersonaComparable(data) {
  const src = data && typeof data === "object" ? data : {};
  const contacto = src.contacto && typeof src.contacto === "object" ? src.contacto : {};
  const domicilio = src.domicilio && typeof src.domicilio === "object" ? src.domicilio : {};
  return {
    "contacto.telefono_celular": toNullableTrimmedString(contacto.telefono_celular),
    "contacto.telefono_fijo": toNullableTrimmedString(contacto.telefono_fijo),
    "contacto.recibe_notificaciones_sms": contacto.recibe_notificaciones_sms === true,
    "domicilio.calle": toNullableTrimmedString(domicilio.calle),
    "domicilio.numero": toNullableTrimmedString(domicilio.numero),
    "domicilio.piso": toNullableTrimmedString(domicilio.piso),
    "domicilio.departamento": toNullableTrimmedString(domicilio.departamento),
    "domicilio.provincia_id": toNullableTrimmedString(domicilio.provincia_id),
    "domicilio.pais_id": toNullableTrimmedString(domicilio.pais_id),
    "domicilio.localidad_id": toNullableTrimmedString(domicilio.localidad_id),
    "domicilio.codigo_postal": toNullableTrimmedString(domicilio.codigo_postal),
    "domicilio.referencia": toNullableTrimmedString(domicilio.referencia),
    dni: toNullableTrimmedString(src.dni),
    nombre: toNullableTrimmedString(src.nombre),
    apellido: toNullableTrimmedString(src.apellido),
    estado_civil_id: toNullableTrimmedString(src.estado_civil_id),
    activo: src.activo !== false,
    motivo_baja_id: toNullableTrimmedString(src.motivo_baja_id),
  };
}

function diffPersonaFields(prevData, nextData) {
  const prev = buildPersonaComparable(prevData);
  const next = buildPersonaComparable(nextData);
  const keys = Object.keys(next);
  return keys
    .filter((key) => prev[key] !== next[key])
    .map((key) => ({ campo: key, anterior: prev[key] ?? null, nuevo: next[key] ?? null }));
}


async function crearEventoDatosPersonales({
  tipo_evento_id,
  persona_id,
  actor_persona_id,
  coleccion,
  accion,
  cambios,
}) {
  const eventoId = `evt_${ulid()}`;
  await db.collection("eventos_ticket").doc(eventoId).set(
    {
      id: eventoId,
      tipo_evento_id,
      tipo_evento_cfg_id: resolveTipoEventoCfgId(tipo_evento_id),
      persona_id: persona_id || null,
      actor_persona_id: actor_persona_id || null,
      ocurrido_en: FieldValue.serverTimestamp(),
      estado_bandeja_rrhh_id: ESTADO_BANDEJA_RRHH_PENDIENTE_ID,
      payload: {
        coleccion,
        accion,
        cambios: Array.isArray(cambios) ? cambios : [],
      },
      schema_version: 1,
    },
    { merge: true },
  );
  return eventoId;
}

function buildTextoLegalCanonicalString(versionId, docData) {
  const raw = docData && typeof docData === "object" ? docData : {};
  const candidates = [
    raw.texto,
    raw.texto_legal,
    raw.contenido,
    raw.cuerpo,
    raw.html,
    raw.markdown,
    raw.nombre,
    raw.titulo,
    raw.version,
  ]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  const canonical = candidates.join("\n---\n");
  return canonical || `version_id:${versionId || ""}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

const rrhhMarcarEventoDatosPersonalesVisto = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const eventoId = toNullableTrimmedString(data.evento_id);
  if (!eventoId) {
    throw new HttpsError("invalid-argument", "[VAL-PER-008] evento_id es obligatorio.");
  }
  const ref = db.collection("eventos_ticket").doc(eventoId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `[VAL-PER-009] Evento inexistente: ${eventoId}.`);
  }
  await ref.set(
    {
      estado_bandeja_rrhh_id: ESTADO_BANDEJA_RRHH_VISTO_ID,
      tomado_conocimiento_en: FieldValue.serverTimestamp(),
      tomado_conocimiento_por_persona_id: getActorPersonaId(request),
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, id: eventoId };
});

function buildNombreCompletoLegal(nombre, apellido) {
  const n = toNullableTrimmedString(nombre);
  const a = toNullableTrimmedString(apellido);
  const full = [n, a].filter(Boolean).join(" ").trim();
  return full || null;
}

function resolveAccionPersonasUpdate(datos, exists) {
  if (!exists) return "guardar_alta";
  const origen = toNullableTrimmedString(datos && datos.origen_flujo);
  if (origen === "perfil_usuario") return "notificar_actualizacion_perfil_usuario";
  return "guardar_actualizacion";
}

const guardarRegistroPersonalTemporal = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const colRaw = typeof d.collectionName === "string" ? d.collectionName.trim() : "";
  if (!COLECCIONES_ESCRITURA_PERSONAL_TEMPORAL.has(colRaw)) {
    throw new HttpsError("invalid-argument", "[VAL-PER-001] Colección personal no permitida para escritura temporal.");
  }
  const datos = d.datos && typeof d.datos === "object" ? d.datos : {};
  const now = FieldValue.serverTimestamp();
  const warnings = [];

  if (colRaw === "personas") {
    const id = toNullableTrimmedString(datos.id) || `per_${ulid()}`;
    const dni = toNullableTrimmedString(datos.dni);
    const nombre = toNullableTrimmedString(datos.nombre);
    const apellido = toNullableTrimmedString(datos.apellido);
    if (!dni || !nombre || !apellido) {
      throw new HttpsError("invalid-argument", "[VAL-PER-002] En personas son obligatorios: dni, nombre y apellido.");
    }
    const fechaNacimiento = toNullableTrimmedString(datos.fecha_nacimiento);
    const lugarNacimientoId = toNullableTrimmedString(datos.lugar_nacimiento_id);
    const sexoGeneroId = toNullableTrimmedString(datos.sexo_genero_id);
    const estadoCivilId = toNullableTrimmedString(datos.estado_civil_id);
    const nacionalidadId = toNullableTrimmedString(datos.nacionalidad_id);
    const contactoTelefono = toNullableTrimmedString(datos.contacto && datos.contacto.telefono_celular);
    const contactoEmail = toNullableTrimmedString(datos.contacto && datos.contacto.email_personal);
    const domCalle = toNullableTrimmedString(datos.domicilio && datos.domicilio.calle);
    const domNumero = toNullableTrimmedString(datos.domicilio && datos.domicilio.numero);
    const domProvinciaId = toNullableTrimmedString(datos.domicilio && datos.domicilio.provincia_id);
    const domPaisId = toNullableTrimmedString(datos.domicilio && datos.domicilio.pais_id);
    const domLocalidadId = toNullableTrimmedString(datos.domicilio && datos.domicilio.localidad_id);
    const domCodigoPostal = toNullableTrimmedString(datos.domicilio && datos.domicilio.codigo_postal);
    if (
      !fechaNacimiento ||
      !lugarNacimientoId ||
      !sexoGeneroId ||
      !estadoCivilId ||
      !nacionalidadId ||
      !contactoTelefono ||
      !contactoEmail ||
      !domCalle ||
      !domNumero ||
      !domProvinciaId ||
      !domPaisId ||
      !domLocalidadId ||
      !domCodigoPostal
    ) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-PER-005] En personas son obligatorios: fecha_nacimiento, lugar_nacimiento_id, sexo_genero_id, estado_civil_id, nacionalidad_id, contacto.telefono_celular, contacto.email_personal, domicilio.calle, domicilio.numero, domicilio.provincia_id, domicilio.pais_id, domicilio.localidad_id y domicilio.codigo_postal.",
      );
    }
    const estadoPerfilDatosId = await resolveEstadoPerfilDatosIdDefault(datos.estado_perfil_datos_id);
    const motivoBajaId = toNullableTrimmedString(datos.motivo_baja_id);
    const activo = datos.activo !== false;
    await assertDocExistsOrNull("cfg_motivo_baja_persona", motivoBajaId, "motivo_baja_id");
    const ref = db.collection(colRaw).doc(id);
    const existingSnap = await ref.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : null;
    const actorIsRrhh = isRrhhActor(request);
    const actorPersonaId = getActorPersonaId(request);
    if (!actorIsRrhh && request.auth) {
      if (!existingSnap.exists) {
        throw new HttpsError("permission-denied", "[AUTH-PER-002] Solo RRHH puede dar de alta registros en personas.");
      }
      if (actorPersonaId !== id) {
        throw new HttpsError("permission-denied", "[AUTH-PER-003] Solo podés actualizar tu propio registro en personas.");
      }
    }

    const payload = {
      persona_id: id,
      dni,
      nombre,
      apellido,
      nombre_completo_legal: buildNombreCompletoLegal(nombre, apellido),
      cuil: toNullableTrimmedString(datos.cuil),
      fecha_nacimiento: toNullableTrimmedString(datos.fecha_nacimiento),
      lugar_nacimiento_id: toNullableTrimmedString(datos.lugar_nacimiento_id),
      lugar_nacimiento_texto: toNullableTrimmedString(datos.lugar_nacimiento_texto),
      motivo_baja_id: motivoBajaId,
      sexo_genero_id: toNullableTrimmedString(datos.sexo_genero_id),
      estado_civil_id: toNullableTrimmedString(datos.estado_civil_id),
      nacionalidad_id: toNullableTrimmedString(datos.nacionalidad_id),
      contacto:
        datos.contacto && typeof datos.contacto === "object"
          ? {
              telefono_celular: toNullableTrimmedString(datos.contacto.telefono_celular),
              email_personal: toNullableTrimmedString(datos.contacto.email_personal),
              telefono_fijo: toNullableTrimmedString(datos.contacto.telefono_fijo),
              recibe_notificaciones_sms: datos.contacto.recibe_notificaciones_sms === true,
            }
          : {},
      domicilio:
        datos.domicilio && typeof datos.domicilio === "object"
          ? {
              calle: toNullableTrimmedString(datos.domicilio.calle),
              numero: toNullableTrimmedString(datos.domicilio.numero),
              piso: toNullableTrimmedString(datos.domicilio.piso),
              departamento: toNullableTrimmedString(datos.domicilio.departamento),
              provincia_id: toNullableTrimmedString(datos.domicilio.provincia_id),
              localidad_id: toNullableTrimmedString(datos.domicilio.localidad_id),
              pais_id: toNullableTrimmedString(datos.domicilio.pais_id),
              codigo_postal: toNullableTrimmedString(datos.domicilio.codigo_postal),
              referencia: toNullableTrimmedString(datos.domicilio.referencia),
            }
          : {},
      foto_rostro:
        datos.foto_rostro && typeof datos.foto_rostro === "object"
          ? {
              storage_path: toNullableTrimmedString(datos.foto_rostro.storage_path),
              storage_path_thumb: toNullableTrimmedString(datos.foto_rostro.storage_path_thumb),
              subido_en: toNullableTrimmedString(datos.foto_rostro.subido_en),
              content_type: toNullableTrimmedString(datos.foto_rostro.content_type),
              origen_captura: toNullableTrimmedString(datos.foto_rostro.origen_captura),
            }
          : null,
      habilitacion_salud:
        datos.habilitacion_salud && typeof datos.habilitacion_salud === "object"
          ? {
              es_profesional: datos.habilitacion_salud.es_profesional === true,
              titulo_habilitante: toNullableTrimmedString(datos.habilitacion_salud.titulo_habilitante),
              matricula_numero: toNullableTrimmedString(datos.habilitacion_salud.matricula_numero),
              matricula_jurisdiccion_id: toNullableTrimmedString(
                datos.habilitacion_salud.matricula_jurisdiccion_id,
              ),
              especialidad_id: toNullableTrimmedString(datos.habilitacion_salud.especialidad_id),
              colegio_id: toNullableTrimmedString(datos.habilitacion_salud.colegio_id),
            }
          : null,
      habilitacion_enfermeria:
        datos.habilitacion_enfermeria && typeof datos.habilitacion_enfermeria === "object"
          ? {
              es_enfermero_profesional: datos.habilitacion_enfermeria.es_enfermero_profesional === true,
              titulo: toNullableTrimmedString(datos.habilitacion_enfermeria.titulo),
              universidad: toNullableTrimmedString(datos.habilitacion_enfermeria.universidad),
              matricula_numero: toNullableTrimmedString(datos.habilitacion_enfermeria.matricula_numero),
              colegio_id: toNullableTrimmedString(datos.habilitacion_enfermeria.colegio_id),
            }
          : null,
      estado_perfil_datos_id: estadoPerfilDatosId,
      perfil_completitud_version: toNumberOrNull(datos.perfil_completitud_version) || 1,
      activo,
      actualizado_en: now,
      schema_version: 1,
    };
    if (!actorIsRrhh && request.auth && hasSensitivePersonaMutation({ existing: existingData, incoming: payload })) {
      throw new HttpsError("permission-denied", MSG_PERSONAS_SENSIBLE_ROL);
    }
    if (!activo && !motivoBajaId) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-PER-004] motivo_baja_id es obligatorio cuando activo=false.",
      );
    }
    if (!toNullableTrimmedString(payload.contacto && payload.contacto.telefono_celular)) {
      pushWarning(
        warnings,
        "VAL-PER-W001",
        "Perfil personal sin telefono_celular en contacto.",
        { persona_id: id, collection: colRaw, campo: "contacto.telefono_celular" },
      );
    }
    if (!toNullableTrimmedString(payload.domicilio && payload.domicilio.codigo_postal)) {
      pushWarning(
        warnings,
        "VAL-PER-W002",
        "Perfil personal sin codigo_postal en domicilio.",
        { persona_id: id, collection: colRaw, campo: "domicilio.codigo_postal" },
      );
    }
    await assertConsistenciaEstadoPerfilCuenta(id, estadoPerfilDatosId);
    const exists = existingSnap.exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    const cambiosEvento = diffPersonaFields(existingData || {}, payload);
    const tipoEvento = existingSnap.exists ? "EVT_DATOS_ACTUALIZA_PERSONAS" : "EVT_DATOS_ALTA_PERSONAS";
    const eventoId = await crearEventoDatosPersonales({
      tipo_evento_id: tipoEvento,
      persona_id: id,
      actor_persona_id: actorPersonaId,
      coleccion: "personas",
      accion: resolveAccionPersonasUpdate(datos, existingSnap.exists),
      cambios: cambiosEvento,
    });
    return { ok: true, id, warnings, evento_id: eventoId };
  }

  if (colRaw === "formacion_agente") {
    const id = toNullableTrimmedString(datos.id) || `for_${ulid()}`;
    const personaId = toNullableTrimmedString(datos.persona_id);
    if (!personaId) throw new HttpsError("invalid-argument", "[VAL-FOR-001] En formacion_agente es obligatorio: persona_id.");
    const nivelEstudiosId = toNullableTrimmedString(datos.nivel_estudios_id);
    if (!nivelEstudiosId) {
      throw new HttpsError("invalid-argument", "[VAL-FOR-002] En formacion_agente es obligatorio: nivel_estudios_id.");
    }
    await assertDocExistsOrNull("personas", personaId, "persona_id");
    const payload = {
      id,
      persona_id: personaId,
      nivel_estudios_id: nivelEstudiosId,
      titulo_completo: toNullableTrimmedString(datos.titulo_completo),
      duracion_anios: toNumberOrNull(datos.duracion_anios),
      institucion: toNullableTrimmedString(datos.institucion),
      matricula_numero: toNullableTrimmedString(datos.matricula_numero),
      especialidad_id: toNullableTrimmedString(datos.especialidad_id),
      colegio_id: toNullableTrimmedString(datos.colegio_id),
      matricula_jurisdiccion_id: toNullableTrimmedString(datos.matricula_jurisdiccion_id),
      activo: datos.activo !== false,
      actualizado_en: now,
      schema_version: 1,
    };
    await assertDocExistsOrNull("cfg_especialidad", payload.especialidad_id, "especialidad_id");
    await assertDocExistsOrNull("cfg_colegio", payload.colegio_id, "colegio_id");
    await assertDocExistsOrNull(
      "cfg_jurisdiccion_matricula",
      payload.matricula_jurisdiccion_id,
      "matricula_jurisdiccion_id",
    );
    const ref = db.collection(colRaw).doc(id);
    const existing = await ref.get();
    const exists = existing.exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    const actorPersonaId = getActorPersonaId(request);
    const cambios = buildTopLevelChanges(existing.data() || {}, payload, [
      "persona_id",
      "nivel_estudios_id",
      "titulo_completo",
      "duracion_anios",
      "institucion",
      "matricula_numero",
      "especialidad_id",
      "colegio_id",
      "matricula_jurisdiccion_id",
      "activo",
    ]);
    await crearEventoDatosPersonales({
      tipo_evento_id: exists ? "EVT_DATOS_ACTUALIZA_FORMACION" : "EVT_DATOS_ALTA_FORMACION",
      persona_id: personaId,
      actor_persona_id: actorPersonaId,
      coleccion: "formacion_agente",
      accion: exists ? "guardar_actualizacion" : "guardar_alta",
      cambios,
    });
    return { ok: true, id, warnings };
  }

  if (colRaw === "declaraciones_grupo_familiar") {
    const titularPersonaId = toNullableTrimmedString(datos.titular_persona_id);
    if (!titularPersonaId) {
      throw new HttpsError("invalid-argument", "[VAL-DDJJ-001] En declaraciones_grupo_familiar es obligatorio: titular_persona_id.");
    }
    const actorPersonaId = getActorPersonaId(request);
    const result = await db.runTransaction((tx) =>
      processDdjjGrupoFamiliar({
        tx,
        db,
        colRaw,
        titularPersonaId,
        datos,
        now,
        toNullableTrimmedString,
        toNumberOrNull,
        assertDocExistsOrNull,
        resolveTipoEventoCfgId,
        actorPersonaId,
        ESTADO_DDJJ_DEFAULT_PERSONALES,
        DDJJ_ESTADO_PRESENTADA_ID,
        DDJJ_ESTADO_SUPERADA_ID,
        ESTADO_BANDEJA_RRHH_PENDIENTE_ID,
      }),
    );
    return { ok: true, id: result.id, warnings };
  }

  const id = toNullableTrimmedString(datos.id) || `doc_${ulid()}`;
  const personaId = toNullableTrimmedString(datos.persona_id);
  if (!personaId) throw new HttpsError("invalid-argument", "[VAL-CON-001] En consentimientos es obligatorio: persona_id.");
  await assertDocExistsOrNull("personas", personaId, "persona_id");
  await assertDocExistsOrNull("cfg_tipo_consentimiento", toNullableTrimmedString(datos.tipo_consentimiento_id), "tipo_consentimiento_id");
  await assertDocExistsOrNull("cfg_textos_legales", toNullableTrimmedString(datos.version_id), "version_id");
  await assertDocExistsOrNull("cfg_idioma", toNullableTrimmedString(datos.idioma_id), "idioma_id");
  const ref = db.collection(colRaw).doc(id);
  const existing = await ref.get();
  const aceptado = datos.aceptado === true;
  if (!aceptado) {
    throw new HttpsError(
      "invalid-argument",
      "[VAL-CON-003] En etapa funcional de consentimientos, aceptado debe ser true.",
    );
  }
  const versionId = toNullableTrimmedString(datos.version_id);
  const versionSnap = await db.collection("cfg_textos_legales").doc(versionId).get();
  const textoCanonical = buildTextoLegalCanonicalString(versionId, versionSnap.data() || {});
  const textoHashCalculado = sha256Hex(textoCanonical);
  const textoHashInput = toNullableTrimmedString(datos.texto_hash);
  const textoHash = textoHashInput || textoHashCalculado;
  if (!textoHash || textoHash.startsWith("pending")) {
    throw new HttpsError("invalid-argument", "[VAL-CON-004] texto_hash inválido.");
  }
  const tipoConsentimientoId = toNullableTrimmedString(datos.tipo_consentimiento_id);
  const idiomaId = toNullableTrimmedString(datos.idioma_id);
  if (existing.exists && existing.get("aceptado") === true) {
    const samePersona = toNullableTrimmedString(existing.get("persona_id")) === personaId;
    const sameTipo = toNullableTrimmedString(existing.get("tipo_consentimiento_id")) === tipoConsentimientoId;
    const sameVersion = toNullableTrimmedString(existing.get("version_id")) === versionId;
    const sameIdioma = toNullableTrimmedString(existing.get("idioma_id")) === idiomaId;
    const sameHash = toNullableTrimmedString(existing.get("texto_hash")) === textoHash;
    if (!(samePersona && sameTipo && sameVersion && sameIdioma && sameHash)) {
      throw new HttpsError(
        "failed-precondition",
        "[VAL-CON-005] Consentimiento aceptado es inmutable en sus campos legales base.",
      );
    }
  }
  const payload = {
    id,
    persona_id: personaId,
    tipo_consentimiento_id: tipoConsentimientoId,
    version_id: versionId,
    idioma_id: idiomaId,
    texto_hash: textoHash,
    aceptado,
    aceptado_en: toNullableTrimmedString(datos.aceptado_en) ? toNullableTrimmedString(datos.aceptado_en) : now,
    actualizado_en: now,
    schema_version: 1,
  };
  if (!existing.exists) payload.creado_en = now;
  await ref.set(payload, { merge: true });
  const actorPersonaId = getActorPersonaId(request);
  const cambios = buildTopLevelChanges(existing.data() || {}, payload, [
    "persona_id",
    "tipo_consentimiento_id",
    "version_id",
    "idioma_id",
    "texto_hash",
    "aceptado",
    "aceptado_en",
  ]);
  await crearEventoDatosPersonales({
    tipo_evento_id: existing.exists ? "EVT_DATOS_ACTUALIZA_CONSENTIMIENTO" : "EVT_DATOS_ALTA_CONSENTIMIENTO",
    persona_id: personaId,
    actor_persona_id: actorPersonaId,
    coleccion: "consentimientos",
    accion: existing.exists ? "guardar_actualizacion" : "guardar_alta",
    cambios,
  });
  return { ok: true, id, warnings };
});

module.exports = {
  guardarRegistroPersonalTemporal,
  rrhhMarcarEventoDatosPersonalesVisto,
};
