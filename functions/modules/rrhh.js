"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { auth, db, FieldValue } = require("./shared/context");
const runtimeFlags = require("./shared/runtimeFlags.json");
const {
  COL_EVENTOS,
  CFG_ONB,
  CFG_EPD_BORR,
  CFG_PEND_REG,
  COL_GRUPOS_TRABAJO,
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./shared/constants");
const { assertRrhh, normalizeDni, resolveRoleIdsRrhhAlta } = require("./shared/helpers");

const rrhhAltaAgente = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const apellido = typeof d.apellido === "string" ? d.apellido.trim() : "";
  const grupoId = typeof d.grupo_de_trabajo_id === "string" ? d.grupo_de_trabajo_id.trim() : "";
  const njRaw = d.nivel_jerarquico;
  const nivelJerarquico = typeof njRaw === "number" ? njRaw : parseInt(String(njRaw), 10);

  if (!/^\d{6,12}$/.test(dni)) throw new HttpsError("invalid-argument", "DNI inválido (usá solo dígitos, 6–12).");
  if (!nombre || !apellido) throw new HttpsError("invalid-argument", "Nombre y apellido son obligatorios.");
  if (!grupoId) throw new HttpsError("invalid-argument", "Seleccioná un grupo de trabajo.");
  if (!Number.isInteger(nivelJerarquico) || nivelJerarquico < 1 || nivelJerarquico > 99) {
    throw new HttpsError("invalid-argument", "El nivel jerárquico debe ser un entero entre 1 y 99.");
  }

  const gref = db.collection(COL_GRUPOS_TRABAJO).doc(grupoId);
  if (!(await gref.get()).exists) {
    throw new HttpsError("not-found", "El grupo de trabajo no existe o fue dado de baja.");
  }
  const roleIds = await resolveRoleIdsRrhhAlta(d.role_ids);
  const q = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(3).get();
  if (!q.empty) throw new HttpsError("already-exists", "Ya existe una persona con ese DNI.");

  const perId = `per_${ulid()}`;
  const usrId = `usr_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(COL_PERSONAS).doc(perId), {
    persona_id: perId,
    dni,
    nombre,
    apellido,
    estado: ESTADO_PENDIENTE_ONBOARDING,
    grupo_de_trabajo_id: grupoId,
    nivel_jerarquico: nivelJerarquico,
    activo: true,
    schema_version: 1,
    estado_perfil_datos_id: CFG_EPD_BORR,
    perfil_completitud_version: 0,
    metadata: { prealta_mvp: true },
    creado_en: ts,
    actualizado_en: ts,
  });
  // Documento nuevo: no usar FieldValue.delete() aquí (set sin merge falla en Firestore).
  batch.set(db.collection(COL_USUARIOS_CUENTA).doc(usrId), {
    persona_id: perId,
    auth_uid: null,
    auth_proveedor_id: null,
    username: null,
    activo: true,
    estado_acceso: CFG_PEND_REG,
    role_ids: roleIds,
    creado_en: ts,
    actualizado_en: ts,
  });
  await batch.commit();
  return { ok: true, persona_id: perId, cuenta_id: usrId };
});

const rrhhActualizarEstadoCuentaAcceso = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const estadoAccesoId = typeof d.estado_acceso_id === "string" ? d.estado_acceso_id.trim() : "";
  const motivo = typeof d.motivo === "string" ? d.motivo.trim() : "";

  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!estadoAccesoId || !/^cfg_eca_/i.test(estadoAccesoId)) {
    throw new HttpsError("invalid-argument", "estado_acceso_id inválido.");
  }

  const [personaSnap, estadoSnap] = await Promise.all([
    db.collection(COL_PERSONAS).doc(personaId).get(),
    db.collection("cfg_estado_cuenta_acceso").doc(estadoAccesoId).get(),
  ]);
  if (!personaSnap.exists) throw new HttpsError("not-found", "La persona no existe.");
  if (!estadoSnap.exists) throw new HttpsError("failed-precondition", "estado_acceso_id no existe en cfg_estado_cuenta_acceso.");

  const cuentaQ = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(1).get();
  if (cuentaQ.empty) throw new HttpsError("not-found", "La cuenta de usuario no existe para esa persona.");

  const cuentaDoc = cuentaQ.docs[0];
  const cuentaId = cuentaDoc.id;
  const estadoPrevio = String(cuentaDoc.get("estado_acceso") || "");
  if (estadoPrevio === estadoAccesoId) {
    return { ok: true, persona_id: personaId, cuenta_id: cuentaId, estado_acceso_id: estadoAccesoId, unchanged: true };
  }

  const now = FieldValue.serverTimestamp();
  const eventoId = `evt_${ulid()}`;
  const actorUid = (request.auth && request.auth.uid) || null;
  await Promise.all([
    db.collection(COL_USUARIOS_CUENTA).doc(cuentaId).set(
      {
        estado_acceso: estadoAccesoId,
        estado_acceso_id: FieldValue.delete(),
        actualizado_en: now,
      },
      { merge: true },
    ),
    db.collection(COL_EVENTOS).doc(eventoId).set({
      tipo_evento_id: "cfg_tev_login",
      actor_uid: actorUid,
      persona_id: personaId,
      cuenta_id: cuentaId,
      modulo_origen: "rrhh",
      accion: "actualizar_estado_cuenta_acceso",
      estado_acceso_anterior_id: estadoPrevio || null,
      estado_acceso_nuevo_id: estadoAccesoId,
      motivo: motivo || null,
      creado_en: now,
      actualizado_en: now,
    }),
  ]);

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
    estado_acceso_anterior_id: estadoPrevio || null,
    estado_acceso_id: estadoAccesoId,
  };
});

const rrhhAplicarBajaLaboral = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const fechaBaja = typeof d.fecha_baja_laboral === "string" ? d.fecha_baja_laboral.trim() : "";
  const causalFinAsignacionId =
    typeof d.causal_fin_asignacion_id === "string" ? d.causal_fin_asignacion_id.trim() : "";
  const motivoBajaPersonaId =
    typeof d.motivo_baja_id === "string" ? d.motivo_baja_id.trim() : "";
  const bloquearAcceso = d.bloquear_acceso !== false;
  const estadoAccesoId = typeof d.estado_acceso_id === "string" ? d.estado_acceso_id.trim() : "cfg_eca_bloq";
  const motivo = typeof d.motivo === "string" ? d.motivo.trim() : "";

  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!fechaBaja) throw new HttpsError("invalid-argument", "fecha_baja_laboral es obligatoria.");
  if (!causalFinAsignacionId) {
    throw new HttpsError("invalid-argument", "causal_fin_asignacion_id es obligatoria.");
  }

  const [personaSnap, causalSnap, motivoSnap] = await Promise.all([
    db.collection(COL_PERSONAS).doc(personaId).get(),
    db.collection("cfg_causal_fin_asignacion_laboral").doc(causalFinAsignacionId).get(),
    motivoBajaPersonaId
      ? db.collection("cfg_motivo_baja_persona").doc(motivoBajaPersonaId).get()
      : Promise.resolve(null),
  ]);
  if (!personaSnap.exists) throw new HttpsError("not-found", "La persona no existe.");
  if (!causalSnap.exists) {
    throw new HttpsError("failed-precondition", "causal_fin_asignacion_id no existe en cfg_causal_fin_asignacion_laboral.");
  }
  if (motivoBajaPersonaId && (!motivoSnap || !motivoSnap.exists)) {
    throw new HttpsError("failed-precondition", "motivo_baja_id no existe en cfg_motivo_baja_persona.");
  }

  const estadoFinalizadaSnap = await db.collection("cfg_estado_asignacion_laboral").doc("CFG_EST_LAB_03_FINALIZADA").get();
  const estadoAsignacionFinalId = estadoFinalizadaSnap.exists ? "CFG_EST_LAB_03_FINALIZADA" : null;

  const hlcAbiertosSnap = await db
    .collection("historial_laboral_cargos")
    .where("persona_id", "==", personaId)
    .where("fecha_hasta", "==", null)
    .get();
  if (hlcAbiertosSnap.empty) {
    throw new HttpsError("failed-precondition", "La persona no tiene HLc vigentes para cerrar.");
  }

  const hlgAbiertosSnap = await db
    .collection("historial_laboral_grupos")
    .where("persona_id", "==", personaId)
    .where("fecha_fin", "==", null)
    .get();
  if (!hlgAbiertosSnap.empty) {
    const ids = hlgAbiertosSnap.docs.slice(0, 10).map((doc) => doc.id);
    throw new HttpsError(
      "failed-precondition",
      `No se puede aplicar baja laboral: primero cerrá los periodos HLg vigentes del agente (${hlgAbiertosSnap.size}). Ejemplos: ${ids.join(", ")}.`,
    );
  }

  const cuentaQ = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(1).get();
  const cuentaDoc = cuentaQ.empty ? null : cuentaQ.docs[0];
  let estadoAccesoPrevio = null;
  if (bloquearAcceso && cuentaDoc) {
    const estadoSnap = await db.collection("cfg_estado_cuenta_acceso").doc(estadoAccesoId).get();
    if (!estadoSnap.exists) {
      throw new HttpsError("failed-precondition", "estado_acceso_id no existe en cfg_estado_cuenta_acceso.");
    }
    estadoAccesoPrevio = String(cuentaDoc.get("estado_acceso") || "");
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  hlcAbiertosSnap.docs.forEach((doc) => {
    const payload = {
      fecha_hasta: fechaBaja,
      causal_fin_asignacion_id: causalFinAsignacionId,
      actualizado_en: now,
      activo: false,
    };
    if (estadoAsignacionFinalId) payload.estado_asignacion_id = estadoAsignacionFinalId;
    batch.set(doc.ref, payload, { merge: true });
  });

  batch.set(
    db.collection(COL_PERSONAS).doc(personaId),
    {
      activo: false,
      motivo_baja_id: motivoBajaPersonaId || null,
      fecha_baja_laboral: fechaBaja,
      actualizado_en: now,
    },
    { merge: true },
  );

  if (bloquearAcceso && cuentaDoc) {
    batch.set(
      cuentaDoc.ref,
      {
        estado_acceso: estadoAccesoId,
        estado_acceso_id: FieldValue.delete(),
        actualizado_en: now,
      },
      { merge: true },
    );
  }

  const eventoId = `evt_${ulid()}`;
  batch.set(db.collection(COL_EVENTOS).doc(eventoId), {
    tipo_evento_id: "cfg_tev_login",
    actor_uid: (request.auth && request.auth.uid) || null,
    persona_id: personaId,
    cuenta_id: cuentaDoc ? cuentaDoc.id : null,
    modulo_origen: "rrhh",
    accion: "aplicar_baja_laboral",
    fecha_baja_laboral: fechaBaja,
    causal_fin_asignacion_id: causalFinAsignacionId,
    motivo_baja_id: motivoBajaPersonaId || null,
    bloquear_acceso: bloquearAcceso,
    estado_acceso_anterior_id: estadoAccesoPrevio,
    estado_acceso_nuevo_id: bloquearAcceso && cuentaDoc ? estadoAccesoId : null,
    motivo: motivo || null,
    cantidad_hlc_cerrados: hlcAbiertosSnap.size,
    creado_en: now,
    actualizado_en: now,
  });

  await batch.commit();
  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaDoc ? cuentaDoc.id : null,
    fecha_baja_laboral: fechaBaja,
    cantidad_hlc_cerrados: hlcAbiertosSnap.size,
    estado_acceso_id: bloquearAcceso && cuentaDoc ? estadoAccesoId : null,
  };
});

const rrhhReiniciarVinculacionCuenta = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const resetEstadoOnboarding = d.reset_estado_onboarding === true;
  const estadoAccesoId = typeof d.estado_acceso_id === "string" ? d.estado_acceso_id.trim() : CFG_PEND_REG;
  const motivo = typeof d.motivo === "string" ? d.motivo.trim() : "";

  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!estadoAccesoId || !/^cfg_eca_/i.test(estadoAccesoId)) {
    throw new HttpsError("invalid-argument", "estado_acceso_id inválido.");
  }

  const personaRef = db.collection(COL_PERSONAS).doc(personaId);
  const personaSnap = await personaRef.get();
  if (!personaSnap.exists) throw new HttpsError("not-found", "La persona no existe.");
  const estadoSnap = await db.collection("cfg_estado_cuenta_acceso").doc(estadoAccesoId).get();
  if (!estadoSnap.exists) {
    throw new HttpsError("failed-precondition", "estado_acceso_id no existe en cfg_estado_cuenta_acceso.");
  }

  const cuentaQ = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(1).get();
  if (cuentaQ.empty) throw new HttpsError("not-found", "No existe usuarios_cuenta para la persona.");
  const cuentaDoc = cuentaQ.docs[0];
  const cuentaData = cuentaDoc.data() || {};
  const authUidPrevio = typeof cuentaData.auth_uid === "string" ? cuentaData.auth_uid.trim() : "";
  const usernamePrevio = typeof cuentaData.username === "string" ? cuentaData.username.trim() : "";
  const estadoAccesoPrevio = String(cuentaData.estado_acceso || "");

  if (authUidPrevio) {
    try {
      await auth.revokeRefreshTokens(authUidPrevio);
    } catch (e) {
      throw new HttpsError("failed-precondition", "No se pudo revocar sesión de la cuenta Auth vinculada.");
    }
  }

  const now = FieldValue.serverTimestamp();
  const eventoId = `evt_${ulid()}`;
  const batch = db.batch();
  batch.set(
    cuentaDoc.ref,
    {
      auth_uid: null,
      username: null,
      estado_acceso: estadoAccesoId,
      estado_acceso_id: FieldValue.delete(),
      actualizado_en: now,
    },
    { merge: true },
  );
  if (resetEstadoOnboarding) {
    batch.set(
      personaRef,
      {
        estado: "PENDIENTE_ONBOARDING",
        estado_perfil_datos_id: CFG_EPD_BORR,
        metadata: {
          auth_vinculado: false,
          vinculado_en: null,
        },
        actualizado_en: now,
      },
      { merge: true },
    );
  }
  batch.set(db.collection(COL_EVENTOS).doc(eventoId), {
    tipo_evento_id: "cfg_tev_login",
    actor_uid: (request.auth && request.auth.uid) || null,
    persona_id: personaId,
    cuenta_id: cuentaDoc.id,
    modulo_origen: "rrhh",
    accion: "reiniciar_vinculacion_cuenta",
    auth_uid_anterior: authUidPrevio || null,
    username_anterior: usernamePrevio || null,
    estado_acceso_anterior_id: estadoAccesoPrevio || null,
    estado_acceso_nuevo_id: estadoAccesoId,
    reset_estado_onboarding: resetEstadoOnboarding,
    estado_sugerido_post_reset: resetEstadoOnboarding ? CFG_ONB : null,
    motivo: motivo || null,
    creado_en: now,
    actualizado_en: now,
  });
  await batch.commit();

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaDoc.id,
    auth_uid_revocado: !!authUidPrevio,
    estado_acceso_id: estadoAccesoId,
    reset_estado_onboarding: resetEstadoOnboarding,
  };
});

module.exports = {
  rrhhAltaAgente,
  rrhhActualizarEstadoCuentaAcceso,
  rrhhAplicarBajaLaboral,
  rrhhReiniciarVinculacionCuenta,
};

