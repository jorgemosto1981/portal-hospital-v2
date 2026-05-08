"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { auth, db, FieldValue } = require("./shared/context");
const {
  CFG_ONB,
  CFG_PEND_REG,
  COL_EVENTOS,
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  MSG_LOGIN,
  MSG_REG_GENERICO,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./shared/constants");
const { checkRateLoginDni, checkRatePrimerDni, normalizeDni, validEmail } = require("./shared/helpers");
const { applyLaborAwareSessionClaims } = require("./shared/authClaims");
const { buildEventoV21, buildPersonaLabel, persistEventoV21 } = require("./shared/eventosV2");
const ESTADO_BANDEJA_RRHH_PENDIENTE_ID = "cfg_ebr_pend_rev";
const TIPO_EVENTO_CFG_EMAIL_SOL = "cfg_tev_auth_email_cambio_solicitado";
const TIPO_EVENTO_CFG_EMAIL_CONF = "cfg_tev_auth_email_cambio_confirmado";
const TIPO_EVENTO_CFG_PASS = "cfg_tev_auth_password_cambio";
const COL_SESIONES_USUARIO = "sesiones_usuario";
const SESSION_ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const SESSION_TOUCH_THROTTLE_MS_DEFAULT = 10 * 60 * 1000;

const resolverEmailLoginDni = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  if (!/^\d{6,12}$/.test(dni)) throw new HttpsError("invalid-argument", MSG_LOGIN);
  await checkRateLoginDni(dni);
  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) throw new HttpsError("failed-precondition", MSG_LOGIN);
  if (psn.size > 1) throw new HttpsError("internal", MSG_LOGIN);
  const personaId = psn.docs[0].id;
  const cSnap = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(2).get();
  if (cSnap.empty) throw new HttpsError("failed-precondition", MSG_LOGIN);
  if (cSnap.size > 1) throw new HttpsError("internal", MSG_LOGIN);
  const cu = cSnap.docs[0].data() || {};
  const uname = cu.username && String(cu.username).trim();
  if (!uname || !validEmail(uname) || !cu.auth_uid) throw new HttpsError("failed-precondition", MSG_LOGIN);
  if (cu.activo === false || cu.estado_acceso === CFG_PEND_REG) throw new HttpsError("failed-precondition", MSG_LOGIN);
  return { email: uname.toLowerCase() };
});

const healthV2 = onCall(async () => ({
  ok: true,
  proyecto: process.env.GCLOUD_PROJECT || null,
  ts: new Date().toISOString(),
}));

const syncSessionClaims = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const uid = request.auth.uid;
  const snap = await db.collection(COL_USUARIOS_CUENTA).where("auth_uid", "==", uid).limit(2).get();
  if (snap.empty) {
    throw new HttpsError(
      "not-found",
      "No hay usuarios_cuenta vinculado a este usuario de Auth. Completá el paso B o verificá datos.",
    );
  }
  if (snap.size > 1) {
    throw new HttpsError("internal", "Inconsistencia: más de un usuarios_cuenta con el mismo auth_uid.");
  }
  const udoc = snap.docs[0];
  const cuentaId = udoc.id;
  const data = udoc.data() || {};
  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";
  if (!personaId) throw new HttpsError("failed-precondition", "La cuenta no tiene persona_id; no se pueden establecer claims.");
  if (data.auth_uid !== uid) throw new HttpsError("internal", "auth_uid del documento no coincide con la sesión.");
  const { profile } = await applyLaborAwareSessionClaims(uid, personaId, cuentaId);
  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
    perfil_rol_id: profile.perfil_rol_id || null,
    cargo_activo: profile.cargo_activo === true,
    labor_rol_conflicto: profile.rol_conflicto === true,
    fecha_referencia_laboral: profile.fecha_referencia || null,
  };
});

const registrarPrimerAcceso = onCall(async (request) => {
  if (request.auth) {
    throw new HttpsError(
      "failed-precondition",
      "Este endpoint solo admite alta inicial sin sesión activa. Si ya iniciaste sesión, usá vinculación por DNI (soporte).",
    );
  }
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const email = typeof d.email === "string" ? d.email.trim() : "";
  const pin = typeof d.pin === "string" ? d.pin.trim() : "";
  if (!/^\d{6,12}$/.test(dni) || !validEmail(email) || !/^\d{6}$/.test(pin)) {
    throw new HttpsError("invalid-argument", MSG_REG_GENERICO);
  }
  const emailNorm = email.toLowerCase();
  await checkRatePrimerDni(dni);

  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  if (psn.size > 1) throw new HttpsError("internal", MSG_REG_GENERICO);
  const personaId = psn.docs[0].id;
  const personaPData = psn.docs[0].data() || {};
  if (personaPData.estado && personaPData.estado !== ESTADO_PENDIENTE_ONBOARDING) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  const personaRef = psn.docs[0].ref;
  const cSnap = await db.collection(COL_USUARIOS_CUENTA).where("persona_id", "==", personaId).limit(2).get();
  if (cSnap.empty || cSnap.size > 1) throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  const cuentaRef = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const cu = cSnap.docs[0].data() || {};
  if (cu.auth_uid || (cu.username != null && String(cu.username).trim() !== "") || cu.estado_acceso !== CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }

  try {
    await auth.getUserByEmail(emailNorm);
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO, { redirect_login: true });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (!(e && e.code === "auth/user-not-found")) throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  let newUid;
  try {
    const rec = await auth.createUser({ email: emailNorm, password: pin, emailVerified: false });
    newUid = rec.uid;
  } catch (e) {
    if (e && e.code === "auth/email-already-exists") {
      throw new HttpsError("failed-precondition", MSG_REG_GENERICO, { redirect_login: true });
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const evtId = `evt_${ulid()}`;
  try {
    await db.runTransaction(async (tx) => {
      const cRead = await tx.get(cuentaRef);
      const cData = cRead.data() || {};
      if (cData.auth_uid) throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
      const pCheck = await tx.get(personaRef);
      const p0 = pCheck.data() || {};
      if (p0.estado && p0.estado !== ESTADO_PENDIENTE_ONBOARDING) {
        throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
      }
      tx.set(
        cuentaRef,
        {
          auth_uid: newUid,
          username: emailNorm,
          estado_acceso: CFG_ONB,
          estado_acceso_id: FieldValue.delete(),
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.update(personaRef, {
        "metadata.auth_vinculado": true,
        "metadata.vinculado_en": FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      });
      persistEventoV21({
        db,
        writer: tx,
        evento: buildEventoV21({
          id: evtId,
          tipo_evento_id: "cfg_tev_login",
          modulo_origen: "login",
          accion: "registrar_primer_acceso",
          persona_id: personaId,
          actor_uid: null,
          actor_persona_id: personaId,
          payload_ui: {
            titulo: "Primer acceso registrado",
            resumen: "Se vinculo la cuenta digital inicial para onboarding.",
            entidad: "usuarios_cuenta",
            persona_afectada_label: buildPersonaLabel(personaPData),
            actor_label: "Sistema",
          },
          payload_contexto: {
            fase: "B",
            motivo: "registro_primer_acceso",
            cuenta_id: cuentaId,
            estado_acceso_nuevo_id: CFG_ONB,
          },
          payload_cambios: [
            {
              campo: "estado_acceso_id",
              label: "Estado de acceso",
              antes: CFG_PEND_REG,
              despues: CFG_ONB,
              antes_label: CFG_PEND_REG,
              despues_label: CFG_ONB,
              tipo: "catalog_id",
            },
          ],
        }),
      });
    });
  } catch (e) {
    try { await auth.deleteUser(newUid); } catch {}
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  let userAfter;
  try {
    userAfter = await auth.getUser(newUid);
  } catch {
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      estado_acceso_id: FieldValue.delete(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try { await auth.deleteUser(newUid); } catch {}
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }
  try {
    await applyLaborAwareSessionClaims(newUid, personaId, cuentaId);
  } catch {
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      estado_acceso_id: FieldValue.delete(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try { await auth.deleteUser(newUid); } catch {}
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }
  return { ok: true, persona_id: personaId, cuenta_id: cuentaId };
});

function maskEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  const [u, d] = raw.split("@");
  if (!u || !d) return "—";
  const safeUser = u.length <= 2 ? `${u[0] || "*"}*` : `${u[0]}***${u[u.length - 1]}`;
  return `${safeUser}@${d}`;
}

function toEpochMs(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  if (typeof value.toDate === "function") {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    } catch {
      return 0;
    }
  }
  if (typeof value === "object" && typeof value._seconds === "number") {
    return Number(value._seconds) * 1000;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return Number(value.seconds) * 1000;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function sanitizeSessionId(raw) {
  const id = String(raw || "").trim();
  return id.slice(0, 120);
}

function sanitizeDeviceHint(raw) {
  const hint = String(raw || "").trim();
  return hint ? hint.slice(0, 120) : null;
}

const registrarSesionActiva = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const uid = request.auth.uid;
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const sessionId = sanitizeSessionId(d.session_id);
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "session_id es obligatorio.");
  }
  const deviceHint = sanitizeDeviceHint(d.device_hint);
  const personaId = String(d.persona_id || "").trim() || null;

  const ref = db.collection(COL_SESIONES_USUARIO).doc(uid);
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() || {} : {};
  const prevSessionId = sanitizeSessionId(prev.current_session_id);
  const prevLastSeenMs = toEpochMs(prev.last_seen_at);
  const prevLastLoginMs = toEpochMs(prev.last_login_at);
  const nowMs = Date.now();
  const warningConcurrente =
    !!prevSessionId &&
    prevSessionId !== sessionId &&
    prevLastSeenMs > 0 &&
    nowMs - prevLastSeenMs <= SESSION_ACTIVE_WINDOW_MS;

  await ref.set(
    {
      current_session_id: sessionId,
      last_seen_at: FieldValue.serverTimestamp(),
      last_login_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      updated_by_persona_id: personaId,
      device_hint: deviceHint,
    },
    { merge: true },
  );

  return {
    ok: true,
    warning_concurrente: warningConcurrente,
    last_login_at_previo_ms: prevLastLoginMs || null,
    active_window_ms: SESSION_ACTIVE_WINDOW_MS,
  };
});

const verificarSesionConcurrente = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const uid = request.auth.uid;
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const sessionId = sanitizeSessionId(d.session_id);
  if (!sessionId) {
    throw new HttpsError("invalid-argument", "session_id es obligatorio.");
  }
  const touch = d.touch === true;
  const throttleRaw = Number(d.touch_throttle_ms);
  const touchThrottleMs =
    Number.isFinite(throttleRaw) && throttleRaw >= 60 * 1000 && throttleRaw <= 24 * 60 * 60 * 1000
      ? Math.floor(throttleRaw)
      : SESSION_TOUCH_THROTTLE_MS_DEFAULT;

  const ref = db.collection(COL_SESIONES_USUARIO).doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() || {} : {};
  const currentSessionId = sanitizeSessionId(data.current_session_id);
  const lastSeenMs = toEpochMs(data.last_seen_at);
  const lastLoginMs = toEpochMs(data.last_login_at);
  const nowMs = Date.now();
  const warningConcurrente =
    !!currentSessionId &&
    currentSessionId !== sessionId &&
    lastSeenMs > 0 &&
    nowMs - lastSeenMs <= SESSION_ACTIVE_WINDOW_MS;

  if (touch && currentSessionId === sessionId) {
    const shouldTouch = !lastSeenMs || nowMs - lastSeenMs >= touchThrottleMs;
    if (shouldTouch) {
      await ref.set(
        {
          last_seen_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return {
    ok: true,
    warning_concurrente: warningConcurrente,
    last_login_at_ms: lastLoginMs || null,
    active_window_ms: SESSION_ACTIVE_WINDOW_MS,
  };
});

/**
 * Tras confirmar correo en Auth, alinea la ficha `personas.contacto.email_personal` con el correo de cuenta
 * (normativa V2: correo de acceso en `usuarios_cuenta.username`; la ficha suele mostrar `email_personal`).
 */
async function alinearEmailPersonalPersona(personaId, emailLower) {
  const pid = String(personaId || "").trim();
  const em = String(emailLower || "").trim().toLowerCase();
  if (!pid || !em || !validEmail(em)) return;
  try {
    await db.collection(COL_PERSONAS).doc(pid).update({
      "contacto.email_personal": em,
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("[notificarCambioEmailAuth] alinearEmailPersonalPersona:", e && e.message);
  }
}

async function resolveCuentaByAuthUid(uid) {
  const snap = await db.collection(COL_USUARIOS_CUENTA).where("auth_uid", "==", uid).limit(2).get();
  if (snap.empty) throw new HttpsError("failed-precondition", "No existe cuenta vinculada para esta sesión.");
  if (snap.size > 1) throw new HttpsError("internal", "Inconsistencia: múltiples cuentas para la misma sesión.");
  return snap.docs[0];
}

async function registrarEventoAuthCambio({
  personaId,
  actorUid,
  actorPersonaId,
  tipoEventoCfgId,
  accion,
  titulo,
  resumen,
  payloadExtra = {},
}) {
  const eventoId = `evt_${ulid()}`;
  const personaSnap = personaId ? await db.collection(COL_PERSONAS).doc(personaId).get() : null;
  const personaData = personaSnap && personaSnap.exists ? personaSnap.data() || {} : {};
  await persistEventoV21({
    db,
    evento: buildEventoV21({
      id: eventoId,
      tipo_evento_id: tipoEventoCfgId,
      modulo_origen: "login",
      accion,
      persona_id: personaId || null,
      actor_uid: actorUid || null,
      actor_persona_id: actorPersonaId || personaId || null,
      payload_ui: {
        titulo,
        resumen,
        entidad: "usuarios_cuenta",
        persona_afectada_label: buildPersonaLabel(personaData),
        actor_label: actorUid || actorPersonaId || "Usuario",
      },
      payload_contexto: {
        estado_bandeja_rrhh_id: ESTADO_BANDEJA_RRHH_PENDIENTE_ID,
        ...payloadExtra,
      },
      payload_cambios: [],
    }),
  });
  return eventoId;
}

const notificarCambioEmailAuth = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const uid = request.auth.uid;
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const etapa = String(d.etapa || "solicitado").trim().toLowerCase();
  const nuevoEmail = String(d.nuevo_email || "").trim().toLowerCase();
  if (!validEmail(nuevoEmail)) throw new HttpsError("invalid-argument", "nuevo_email inválido.");
  if (!["solicitado", "confirmado"].includes(etapa)) {
    throw new HttpsError("invalid-argument", "etapa inválida.");
  }

  const cuentaDoc = await resolveCuentaByAuthUid(uid);
  const cuenta = cuentaDoc.data() || {};
  const personaId = String(cuenta.persona_id || "").trim();
  if (!personaId) throw new HttpsError("failed-precondition", "Cuenta sin persona_id.");

  const userAuth = await auth.getUser(uid);
  const emailActualAuth = String(userAuth.email || "").trim().toLowerCase();
  if (etapa === "confirmado") {
    if (emailActualAuth !== nuevoEmail) {
      throw new HttpsError("failed-precondition", "El email autenticado no coincide con nuevo_email.");
    }
    await alinearEmailPersonalPersona(personaId, nuevoEmail);

    const usernameActual = String(cuenta.username || "").trim().toLowerCase();
    if (usernameActual === nuevoEmail) {
      return { ok: true, persona_id: personaId, evento_id: null, skipped: true };
    }
    await cuentaDoc.ref.set(
      {
        username: nuevoEmail,
        actualizado_en: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const tipoEventoCfgId = etapa === "confirmado" ? TIPO_EVENTO_CFG_EMAIL_CONF : TIPO_EVENTO_CFG_EMAIL_SOL;
  const accion =
    etapa === "confirmado" ? "notificar_cambio_email_confirmado" : "notificar_cambio_email_solicitado";
  const eventoId = await registrarEventoAuthCambio({
    personaId,
    actorUid: uid,
    actorPersonaId: personaId,
    tipoEventoCfgId,
    accion,
    titulo: etapa === "confirmado" ? "Cambio de email confirmado" : "Cambio de email solicitado",
    resumen:
      etapa === "confirmado"
        ? "Se confirmo el nuevo email de acceso."
        : "El usuario solicito cambio de email de acceso.",
    payloadExtra: {
      email_anterior_mask: maskEmail(cuenta.username || null),
      email_nuevo_mask: maskEmail(nuevoEmail),
      verificado: userAuth.emailVerified === true,
      coleccion: "usuarios_cuenta",
    },
  });

  return { ok: true, persona_id: personaId, evento_id: eventoId };
});

const notificarCambioPasswordAuth = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Se requiere sesión.");
  const uid = request.auth.uid;
  const cuentaDoc = await resolveCuentaByAuthUid(uid);
  const cuenta = cuentaDoc.data() || {};
  const personaId = String(cuenta.persona_id || "").trim();
  if (!personaId) throw new HttpsError("failed-precondition", "Cuenta sin persona_id.");

  const eventoId = await registrarEventoAuthCambio({
    personaId,
    actorUid: uid,
    actorPersonaId: personaId,
    tipoEventoCfgId: TIPO_EVENTO_CFG_PASS,
    accion: "notificar_cambio_password",
    titulo: "Cambio de password",
    resumen: "El usuario informo cambio de contraseña de acceso.",
    payloadExtra: {
      metodo: "password",
      coleccion: "usuarios_cuenta",
    },
  });
  return { ok: true, persona_id: personaId, evento_id: eventoId };
});

module.exports = {
  resolverEmailLoginDni,
  healthV2,
  syncSessionClaims,
  registrarPrimerAcceso,
  registrarSesionActiva,
  verificarSesionConcurrente,
  notificarCambioEmailAuth,
  notificarCambioPasswordAuth,
};

