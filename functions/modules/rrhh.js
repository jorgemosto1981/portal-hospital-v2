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
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./shared/constants");
const { assertRrhh, normalizeDni } = require("./shared/helpers");
const { calcularAntiguedad } = require("./shared/antiguedadCalculator");
const { buildEventoV21, buildPersonaLabel, persistEventoV21 } = require("./shared/eventosV2");

const DDJJ_ESTADO_NO_INICIADA_ID = "CFG_DDJJ_01_NO_INICIADA";

function parseFechaCorteOrToday(rawFechaCorte) {
  if (typeof rawFechaCorte === "string" && rawFechaCorte.trim()) {
    return rawFechaCorte.trim();
  }
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveExternosDesdePersona(persona) {
  if (!persona || typeof persona !== "object") return 0;
  const recArrayCandidates = [
    persona.antiguedad_reconocimientos,
    persona.antiguedad_externa_reconocimientos,
    persona.reconocimientos_antiguedad,
  ];
  for (const candidate of recArrayCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  const daysCandidates = [
    persona.antiguedad_reconocida_dias,
    persona.antiguedad_externa_dias,
    persona.dias_antiguedad_reconocida,
  ];
  for (const candidate of daysCandidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function toNonNegativeInt(value, fieldName) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpsError("invalid-argument", `${fieldName} debe ser numérico y mayor o igual a 0.`);
  }
  return Math.floor(n);
}

const rrhhAltaAgente = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const apellido = typeof d.apellido === "string" ? d.apellido.trim() : "";

  if (!/^\d{6,12}$/.test(dni)) throw new HttpsError("invalid-argument", "DNI inválido (usá solo dígitos, 6–12).");
  if (!nombre || !apellido) throw new HttpsError("invalid-argument", "Nombre y apellido son obligatorios.");
  const q = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(3).get();
  if (!q.empty) throw new HttpsError("already-exists", "Ya existe una persona con ese DNI.");

  const perId = `per_${ulid()}`;
  const usrId = `usr_${ulid()}`;
  const ddjjId = `gf_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection(COL_PERSONAS).doc(perId), {
    persona_id: perId,
    dni,
    nombre,
    apellido,
    estado: ESTADO_PENDIENTE_ONBOARDING,
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
    creado_en: ts,
    actualizado_en: ts,
  });
  batch.set(db.collection("declaraciones_grupo_familiar").doc(ddjjId), {
    id: ddjjId,
    titular_persona_id: perId,
    declaracion_version: 1,
    estado_declaracion_id: DDJJ_ESTADO_NO_INICIADA_ID,
    declaracion_jurada_aceptada: false,
    aceptada_en: null,
    familiares: [],
    creado_en: ts,
    actualizado_en: ts,
    schema_version: 1,
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
  const actorPersonaId = (request.auth && request.auth.token && request.auth.token.persona_id) || null;
  const personaLabel = buildPersonaLabel(personaSnap.data() || {});
  const estadoNuevoData = estadoSnap.data() || {};
  const estadoNuevoLabel =
    (typeof estadoNuevoData.titulo_ui === "string" && estadoNuevoData.titulo_ui.trim()) ||
    (typeof estadoNuevoData.nombre === "string" && estadoNuevoData.nombre.trim()) ||
    estadoAccesoId;
  await Promise.all([
    db.collection(COL_USUARIOS_CUENTA).doc(cuentaId).set(
      {
        estado_acceso: estadoAccesoId,
        estado_acceso_id: FieldValue.delete(),
        actualizado_en: now,
      },
      { merge: true },
    ),
    persistEventoV21({
      db,
      evento: buildEventoV21({
        id: eventoId,
        tipo_evento_id: "cfg_tev_rrhh",
        modulo_origen: "rrhh",
        accion: "actualizar_estado_cuenta_acceso",
        persona_id: personaId,
        actor_uid: actorUid,
        actor_persona_id: actorPersonaId,
        payload_ui: {
          titulo: "Estado de acceso actualizado",
          resumen: "RRHH actualizo el estado de acceso de la cuenta.",
          entidad: "usuarios_cuenta",
          persona_afectada_label: personaLabel,
          actor_label: actorUid || "RRHH",
        },
        payload_contexto: {
          cuenta_id: cuentaId,
          estado_anterior_id: estadoPrevio || null,
          estado_nuevo_id: estadoAccesoId,
          motivo: motivo || null,
        },
        payload_cambios: [
          {
            campo: "estado_acceso_id",
            label: "Estado de acceso",
            antes: estadoPrevio || null,
            despues: estadoAccesoId,
            antes_label: estadoPrevio || null,
            despues_label: estadoNuevoLabel,
            tipo: "catalog_id",
          },
        ],
      }),
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
  const actorUid = (request.auth && request.auth.uid) || null;
  const actorPersonaId = (request.auth && request.auth.token && request.auth.token.persona_id) || null;
  const personaLabel = buildPersonaLabel(personaSnap.data() || {});
  persistEventoV21({
    db,
    writer: batch,
    evento: buildEventoV21({
      id: eventoId,
      tipo_evento_id: "cfg_tev_rrhh",
      modulo_origen: "rrhh",
      accion: "aplicar_baja_laboral",
      persona_id: personaId,
      actor_uid: actorUid,
      actor_persona_id: actorPersonaId,
      payload_ui: {
        titulo: "Baja laboral aplicada",
        resumen: `Se cerraron ${hlcAbiertosSnap.size} registros HLc vigentes para la persona.`,
        entidad: "historial_laboral_cargos",
        persona_afectada_label: personaLabel,
        actor_label: actorUid || "RRHH",
      },
      payload_contexto: {
        cuenta_id: cuentaDoc ? cuentaDoc.id : null,
        fecha_baja_laboral: fechaBaja,
        causal_fin_asignacion_id: causalFinAsignacionId,
        motivo_baja_id: motivoBajaPersonaId || null,
        bloquear_acceso: bloquearAcceso,
        estado_acceso_anterior_id: estadoAccesoPrevio,
        estado_acceso_nuevo_id: bloquearAcceso && cuentaDoc ? estadoAccesoId : null,
        motivo: motivo || null,
        cantidad_hlc_cerrados: hlcAbiertosSnap.size,
      },
      payload_cambios: [
        {
          campo: "activo",
          label: "Estado de persona",
          antes: true,
          despues: false,
          antes_label: "Activo",
          despues_label: "Inactivo por baja laboral",
          tipo: "boolean",
        },
      ],
    }),
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
  const actorUid = (request.auth && request.auth.uid) || null;
  const actorPersonaId = (request.auth && request.auth.token && request.auth.token.persona_id) || null;
  const personaLabel = buildPersonaLabel(personaSnap.data() || {});
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
  persistEventoV21({
    db,
    writer: batch,
    evento: buildEventoV21({
      id: eventoId,
      tipo_evento_id: "cfg_tev_rrhh",
      modulo_origen: "rrhh",
      accion: "reiniciar_vinculacion_cuenta",
      persona_id: personaId,
      actor_uid: actorUid,
      actor_persona_id: actorPersonaId,
      payload_ui: {
        titulo: "Cuenta desvinculada para nueva vinculacion",
        resumen: "RRHH reinicio la vinculacion de cuenta y revoco la sesion previa.",
        entidad: "usuarios_cuenta",
        persona_afectada_label: personaLabel,
        actor_label: actorUid || "RRHH",
      },
      payload_contexto: {
        cuenta_id: cuentaDoc.id,
        auth_uid_anterior: authUidPrevio || null,
        username_anterior: usernamePrevio || null,
        estado_acceso_anterior_id: estadoAccesoPrevio || null,
        estado_acceso_nuevo_id: estadoAccesoId,
        reset_estado_onboarding: resetEstadoOnboarding,
        estado_sugerido_post_reset: resetEstadoOnboarding ? CFG_ONB : null,
        motivo: motivo || null,
      },
      payload_cambios: [
        {
          campo: "auth_uid",
          label: "Vinculacion Auth",
          antes: authUidPrevio || null,
          despues: null,
          antes_label: authUidPrevio || "Sin vinculacion",
          despues_label: "Sin vinculacion",
          tipo: "string",
        },
        {
          campo: "estado_acceso_id",
          label: "Estado de acceso",
          antes: estadoAccesoPrevio || null,
          despues: estadoAccesoId,
          antes_label: estadoAccesoPrevio || null,
          despues_label: estadoAccesoId,
          tipo: "catalog_id",
        },
      ],
    }),
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

const rrhhCalcularAntiguedadPersona = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const fechaCorte = parseFechaCorteOrToday(d.fecha_corte);

  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }

  const personaRef = db.collection(COL_PERSONAS).doc(personaId);
  const [personaSnap, hlcSnap] = await Promise.all([
    personaRef.get(),
    db.collection("historial_laboral_cargos").where("persona_id", "==", personaId).get(),
  ]);
  if (!personaSnap.exists) {
    throw new HttpsError("not-found", "La persona no existe.");
  }

  const persona = personaSnap.data() || {};
  const hlcArray = hlcSnap.docs.map((doc) => {
    const row = doc.data() || {};
    return {
      ...row,
      id: doc.id,
      fecha_inicio: row.fecha_inicio || row.fecha_desde || null,
      fecha_fin: row.fecha_fin || row.fecha_hasta || null,
    };
  });

  const diasExternos = resolveExternosDesdePersona(persona);
  try {
    const resultado = calcularAntiguedad(hlcArray, fechaCorte, diasExternos);
    return {
      ok: true,
      persona_id: personaId,
      fecha_corte: fechaCorte,
      cantidad_hlc_origen: hlcArray.length,
      fuente_antiguedad_externa: Array.isArray(diasExternos) ? "reconocimientos" : "dias",
      resultado,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido";
    throw new HttpsError("failed-precondition", `No se pudo calcular antigüedad: ${detail}`);
  }
});

const rrhhGuardarAntiguedadExternaPersona = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  const normativa = typeof d.normativa === "string" ? d.normativa.trim() : "";
  const fechaImpacto = typeof d.desde === "string" ? d.desde.trim() : "";
  const observacion = typeof d.observacion === "string" ? d.observacion.trim() : "";

  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }
  if (!normativa) {
    throw new HttpsError("invalid-argument", "normativa es obligatoria.");
  }
  if (!fechaImpacto) {
    throw new HttpsError("invalid-argument", "desde (fecha de impacto) es obligatoria.");
  }
  const years = toNonNegativeInt(d.anios, "años");
  const months = toNonNegativeInt(d.meses, "meses");
  const days = toNonNegativeInt(d.dias, "días");
  if (months > 11) {
    throw new HttpsError("invalid-argument", "meses debe ser menor o igual a 11.");
  }
  if (days > 31) {
    throw new HttpsError("invalid-argument", "días debe ser menor o igual a 31.");
  }
  const diasReconocidos = years * 365 + months * 30 + days;
  if (diasReconocidos <= 0) {
    throw new HttpsError("invalid-argument", "Ingresá al menos un valor mayor a 0 en años, meses o días.");
  }

  const personaRef = db.collection(COL_PERSONAS).doc(personaId);
  const now = FieldValue.serverTimestamp();
  const reconocimientoId = `rec_ant_${ulid()}`;
  const actorUid = (request.auth && request.auth.uid) || null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(personaRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "La persona no existe.");
    }
    const persona = snap.data() || {};
    const prev = Array.isArray(persona.antiguedad_reconocimientos)
      ? persona.antiguedad_reconocimientos
      : [];
    if (prev.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "La persona ya tiene antigüedad externa cargada. Eliminá la existente antes de crear una nueva.",
      );
    }
    const next = [
      ...prev,
      {
        reconocimiento_id: reconocimientoId,
        dias_reconocidos: diasReconocidos,
        anios: years,
        meses: months,
        dias: days,
        normativa,
        fecha_impacto: fechaImpacto,
        estado: "vigente",
        observacion: observacion || null,
        creado_por_uid: actorUid,
        creado_en: new Date().toISOString(),
      },
    ];
    tx.set(
      personaRef,
      {
        antiguedad_reconocimientos: next,
        actualizado_en: now,
      },
      { merge: true },
    );
  });

  return {
    ok: true,
    persona_id: personaId,
    reconocimiento_id: reconocimientoId,
    dias_reconocidos: diasReconocidos,
  };
});

const rrhhEliminarAntiguedadExternaPersona = onCall(async (request) => {
  if (runtimeFlags.OPEN_ACCESS_TEMP !== true) assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const personaId = typeof d.persona_id === "string" ? d.persona_id.trim() : "";
  if (!personaId || !/^per_/i.test(personaId)) {
    throw new HttpsError("invalid-argument", "persona_id inválido.");
  }

  const personaRef = db.collection(COL_PERSONAS).doc(personaId);
  const now = FieldValue.serverTimestamp();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(personaRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "La persona no existe.");
    }
    tx.set(
      personaRef,
      {
        antiguedad_reconocimientos: [],
        actualizado_en: now,
      },
      { merge: true },
    );
  });

  return {
    ok: true,
    persona_id: personaId,
    eliminada: true,
  };
});

module.exports = {
  rrhhAltaAgente,
  rrhhActualizarEstadoCuentaAcceso,
  rrhhAplicarBajaLaboral,
  rrhhReiniciarVinculacionCuenta,
  rrhhCalcularAntiguedadPersona,
  rrhhGuardarAntiguedadExternaPersona,
  rrhhEliminarAntiguedadExternaPersona,
};

