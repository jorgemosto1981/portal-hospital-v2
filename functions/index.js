"use strict";

const { createHash } = require("node:crypto");

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

/** Región por defecto para nuevas funciones v2 (alinear con Firestore del hospital si aplica). */
setGlobalOptions({ region: "southamerica-east1" });

const COL_PERSONAS = "personas";
const COL_USUARIOS_CUENTA = "usuarios_cuenta";
const COL_EVENTOS = "eventos_ticket";
const COL_RATE_PRIMER_DNI = "_system_reg_primer_dni";
const COL_RATE_LOGIN_DNI = "_system_rate_login_dni";

const CFG_PEND_REG = "cfg_eca_pend_reg";
const CFG_ONB = "cfg_eca_onb";
const CFG_EPD_BORR = "cfg_epd_borr";
const CFG_TEV_LOGIN = "cfg_tev_login";

const RATE_MAX = 7;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const MSG_REG_GENERICO = "No se pudo completar el registro.";

function normalizeDni(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\D/g, "");
}

function assertRrhh(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  const role = request.auth.token && request.auth.token.portal_role;
  if (role !== "rrhh") {
    throw new HttpsError("permission-denied", "Solo personal autorizado (RRHH).");
  }
}

/**
 * Rate limit en Firestore (Admin). Colección privada; reglas default deny.
 * @param {string} normalizedDni
 */
async function checkRatePrimerDni(normalizedDni) {
  const h = createHash("sha256").update(normalizedDni).digest("hex");
  const ref = db.collection(COL_RATE_PRIMER_DNI).doc(h);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const attempts = Array.isArray(data.attempts) ? data.attempts : [];
    const recent = attempts.filter((t) => typeof t === "number" && now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      throw new HttpsError("resource-exhausted", MSG_REG_GENERICO);
    }
    recent.push(now);
    tx.set(
      ref,
      { attempts: recent, actualizado: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

function validEmail(s) {
  if (typeof s !== "string" || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

const MSG_LOGIN = "No se pudo iniciar sesión. Verificá DNI y PIN.";

/**
 * Rate limit independiente al de registro (colección distinta).
 * @param {string} normalizedDni
 */
async function checkRateLoginDni(normalizedDni) {
  const h = createHash("sha256").update(`login_dni:${normalizedDni}`).digest("hex");
  const ref = db.collection(COL_RATE_LOGIN_DNI).doc(h);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const attempts = Array.isArray(data.attempts) ? data.attempts : [];
    const recent = attempts.filter((t) => typeof t === "number" && now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      throw new HttpsError("resource-exhausted", MSG_LOGIN);
    }
    recent.push(now);
    tx.set(
      ref,
      { attempts: recent, actualizado: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });
}

/**
 * Resuelve el email de login a partir del DNI (sin enumerar detalles).
 * El cliente hace luego `signInWithEmailAndPassword(email, pin)` — MODULO_LOGIN_V2 §1.1, §1.3.
 */
exports.resolverEmailLoginDni = onCall(async (request) => {
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  if (!/^\d{6,12}$/.test(dni)) {
    throw new HttpsError("invalid-argument", MSG_LOGIN);
  }
  await checkRateLoginDni(dni);
  const psn = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(2).get();
  if (psn.empty) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (psn.size > 1) {
    throw new HttpsError("internal", MSG_LOGIN);
  }
  const personaId = psn.docs[0].id;
  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", personaId)
    .limit(2)
    .get();
  if (cSnap.empty) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cSnap.size > 1) {
    throw new HttpsError("internal", MSG_LOGIN);
  }
  const cu = cSnap.docs[0].data() || {};
  const uname = cu.username && String(cu.username).trim();
  if (!uname || !validEmail(uname) || !cu.auth_uid) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cu.activo === false) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  if (cu.estado_acceso === CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", MSG_LOGIN);
  }
  return { email: uname.toLowerCase() };
});

/** Comprobación de despliegue / emulador (sin auth). */
exports.healthV2 = onCall(async () => ({
  ok: true,
  proyecto: process.env.GCLOUD_PROJECT || null,
  ts: new Date().toISOString(),
}));

/**
 * Sincroniza custom claims (`persona_id`, `cuenta_id`) desde `usuarios_cuenta` según `MODULO_LOGIN_V2` §3.3.
 * Conserva otras claims (p. ej. `portal_role: "rrhh"`) al fusionar.
 */
exports.syncSessionClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }

  const uid = request.auth.uid;

  const snap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("auth_uid", "==", uid)
    .limit(2)
    .get();

  if (snap.empty) {
    throw new HttpsError(
      "not-found",
      "No hay usuarios_cuenta vinculado a este usuario de Auth. Completá el paso B o verificá datos.",
    );
  }

  if (snap.size > 1) {
    throw new HttpsError(
      "internal",
      "Inconsistencia: más de un usuarios_cuenta con el mismo auth_uid.",
    );
  }

  const udoc = snap.docs[0];
  const cuentaId = udoc.id;
  const data = udoc.data() || {};
  const personaId = typeof data.persona_id === "string" ? data.persona_id.trim() : "";

  if (!personaId) {
    throw new HttpsError(
      "failed-precondition",
      "La cuenta no tiene persona_id; no se pueden establecer claims.",
    );
  }

  if (data.auth_uid !== uid) {
    throw new HttpsError("internal", "auth_uid del documento no coincide con la sesión.");
  }

  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  await auth.setCustomUserClaims(uid, {
    ...prev,
    persona_id: personaId,
    cuenta_id: cuentaId,
  });

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
  };
});

/**
 * Paso A (RRHH): alta mínima `personas` + `usuarios_cuenta` en pendiente de registro.
 * Requiere `request.auth.token.portal_role === "rrhh"` (asignar vía consola/Admin o script en staging).
 * @see MODULO_DATOS_PERSONALES_V2.md §1.2 paso A, MODULO_LOGIN_V2 §4.1
 */
exports.rrhhAltaAgente = onCall(async (request) => {
  assertRrhh(request);
  const d = request.data && typeof request.data === "object" ? request.data : {};
  const dni = normalizeDni(d.dni);
  const nombre = typeof d.nombre === "string" ? d.nombre.trim() : "";
  const apellido = typeof d.apellido === "string" ? d.apellido.trim() : "";

  if (!/^\d{6,12}$/.test(dni)) {
    throw new HttpsError("invalid-argument", "DNI inválido (usá solo dígitos, 6–12).");
  }
  if (!nombre || !apellido) {
    throw new HttpsError("invalid-argument", "Nombre y apellido son obligatorios.");
  }

  const q = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(3).get();
  if (!q.empty) {
    throw new HttpsError("already-exists", "Ya existe una persona con ese DNI.");
  }

  const perId = `per_${ulid()}`;
  const usrId = `usr_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(
    db.collection(COL_PERSONAS).doc(perId),
    {
      persona_id: perId,
      dni,
      nombre,
      apellido,
      activo: true,
      schema_version: 1,
      estado_perfil_datos_id: CFG_EPD_BORR,
      perfil_completitud_version: 0,
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: false },
  );
  batch.set(
    db.collection(COL_USUARIOS_CUENTA).doc(usrId),
    {
      persona_id: perId,
      auth_uid: null,
      auth_proveedor_id: null,
      username: null,
      activo: true,
      estado_acceso: CFG_PEND_REG,
      role_ids: [],
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: false },
  );
  await batch.commit();
  return { ok: true, persona_id: perId, cuenta_id: usrId };
});

/**
 * Paso B: DNI + email + PIN 6; crea Auth, actualiza `usuarios_cuenta`, claims, evento mínimo.
 * Callable sin exigir sesión del agente (DNI+datos en `data`). Mensajes de fallo genéricos (anti enumeración).
 * @see MODULO_LOGIN_V2 §1.1, §4.2, FLUJO_V2 §6
 */
exports.registrarPrimerAcceso = onCall(async (request) => {
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
  if (psn.empty) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (psn.size > 1) {
    console.error("registrarPrimerAcceso: múltiples persona con mismo dni", dni);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const personaId = psn.docs[0].id;

  const cSnap = await db
    .collection(COL_USUARIOS_CUENTA)
    .where("persona_id", "==", personaId)
    .limit(2)
    .get();
  if (cSnap.empty) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cSnap.size > 1) {
    console.error("registrarPrimerAcceso: múltiples cuentas para persona", personaId);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const cuentaRef = cSnap.docs[0].ref;
  const cuentaId = cSnap.docs[0].id;
  const cu = cSnap.docs[0].data() || {};

  if (cu.auth_uid) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cu.username != null && String(cu.username).trim() !== "") {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }
  if (cu.estado_acceso !== CFG_PEND_REG) {
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  }

  try {
    await auth.getUserByEmail(emailNorm);
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  } catch (e) {
    if (e instanceof HttpsError) {
      throw e;
    }
    if (e && e.code === "auth/user-not-found") {
      // correo libre
    } else {
      throw new HttpsError("internal", MSG_REG_GENERICO);
    }
  }

  let newUid;
  try {
    const rec = await auth.createUser({
      email: emailNorm,
      password: pin,
      emailVerified: false,
    });
    newUid = rec.uid;
  } catch (e) {
    if (e && e.code === "auth/email-already-exists") {
      throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
    }
    console.error("registrarPrimerAcceso createUser", e);
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const evtId = `evt_${ulid()}`;

  try {
    await db.runTransaction(async (tx) => {
      const cRead = await tx.get(cuentaRef);
      const cData = cRead.data() || {};
      if (cData.auth_uid) {
        throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
      }
      tx.set(
        cuentaRef,
        {
          auth_uid: newUid,
          username: emailNorm,
          estado_acceso: CFG_ONB,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.set(
        db.collection(COL_EVENTOS).doc(evtId),
        {
          tipo_evento_id: CFG_TEV_LOGIN,
          persona_id: personaId,
          cuenta_id: cuentaId,
          ocurrido_en: FieldValue.serverTimestamp(),
          payload: { fase: "B", motivo: "registro_primer_acceso" },
        },
        { merge: false },
      );
    });
  } catch (e) {
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: txn falló, deleteUser", del);
    }
    if (e instanceof HttpsError) {
      throw e;
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  let userAfter;
  try {
    userAfter = await auth.getUser(newUid);
  } catch (e) {
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: getUser falló, rollback", del);
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  const prev = userAfter.customClaims && typeof userAfter.customClaims === "object" ? { ...userAfter.customClaims } : {};
  try {
    await auth.setCustomUserClaims(newUid, {
      ...prev,
      persona_id: personaId,
      cuenta_id: cuentaId,
    });
  } catch (claimErr) {
    console.error("registrarPrimerAcceso setCustomUserClaims", claimErr);
    const rev = db.batch();
    rev.update(cuentaRef, {
      auth_uid: null,
      username: null,
      estado_acceso: CFG_PEND_REG,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    rev.delete(db.collection(COL_EVENTOS).doc(evtId));
    await rev.commit();
    try {
      await auth.deleteUser(newUid);
    } catch (del) {
      console.error("registrarPrimerAcceso: rollback deleteUser (claims)", del);
    }
    throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
  };
});
