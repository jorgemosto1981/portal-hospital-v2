"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { createHash } = require("node:crypto");
const { db, FieldValue } = require("./shared/context");
const runtimeFlags = require("../../shared/runtimeFlags.json");
const { assertRrhh } = require("./shared/helpers");
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

function buildNombreCompletoLegal(nombre, apellido) {
  const n = toNullableTrimmedString(nombre);
  const a = toNullableTrimmedString(apellido);
  const full = [n, a].filter(Boolean).join(" ").trim();
  return full || null;
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
    const ref = db.collection(colRaw).doc(id);
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id, warnings };
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
    const exists = (await ref.get()).exists;
    if (!exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id, warnings };
  }

  if (colRaw === "declaraciones_grupo_familiar") {
    const id = toNullableTrimmedString(datos.id) || `gf_${ulid()}`;
    const titularPersonaId = toNullableTrimmedString(datos.titular_persona_id);
    if (!titularPersonaId) {
      throw new HttpsError("invalid-argument", "[VAL-DDJJ-001] En declaraciones_grupo_familiar es obligatorio: titular_persona_id.");
    }
    await assertDocExistsOrNull("personas", titularPersonaId, "titular_persona_id");
    const ref = db.collection(colRaw).doc(id);
    const existing = await ref.get();
    const isNew = !existing.exists;
    let declaracionVersion = toNumberOrNull(datos.declaracion_version);
    if (declaracionVersion == null) {
      if (isNew) {
        const prevSnap = await db.collection(colRaw).where("titular_persona_id", "==", titularPersonaId).get();
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
    await assertDocExistsOrNull("cfg_estado_declaracion_ddjj", estadoDeclaracionId, "estado_declaracion_id");
    const payload = {
      id,
      titular_persona_id: titularPersonaId,
      declaracion_version: declaracionVersion,
      estado_declaracion_id: estadoDeclaracionId,
      declaracion_jurada_aceptada: existing.exists ? existing.get("declaracion_jurada_aceptada") === true : false,
      aceptada_en: existing.exists ? existing.get("aceptada_en") || null : null,
      familiares: Array.isArray(datos.familiares) ? datos.familiares : [],
      actualizado_en: now,
      schema_version: 1,
    };
    if (!Array.isArray(payload.familiares) || payload.familiares.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "[VAL-DDJJ-002] Debe informarse al menos un familiar en declaraciones_grupo_familiar.",
      );
    }
    const familiaresIncompletos = payload.familiares.some((f) => {
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
    if (!existing.exists) payload.creado_en = now;
    await ref.set(payload, { merge: true });
    return { ok: true, id, warnings };
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
  return { ok: true, id, warnings };
});

module.exports = { guardarRegistroPersonalTemporal };
