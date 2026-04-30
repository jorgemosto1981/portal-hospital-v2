"use strict";

const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { ulid } = require("ulid");
const { auth, db, FieldValue } = require("./shared/context");
const {
  CFG_ONB,
  CFG_PEND_REG,
  CFG_TEV_LOGIN,
  COL_EVENTOS,
  COL_PERSONAS,
  COL_USUARIOS_CUENTA,
  MSG_LOGIN,
  MSG_REG_GENERICO,
  ESTADO_PENDIENTE_ONBOARDING,
} = require("./shared/constants");
const { checkRateLoginDni, checkRatePrimerDni, normalizeDni, validEmail } = require("./shared/helpers");

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
  const user = await auth.getUser(uid);
  const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
  await auth.setCustomUserClaims(uid, { ...prev, persona_id: personaId, cuenta_id: cuentaId });
  return { ok: true, persona_id: personaId, cuenta_id: cuentaId };
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
    throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (!(e && e.code === "auth/user-not-found")) throw new HttpsError("internal", MSG_REG_GENERICO);
  }

  let newUid;
  try {
    const rec = await auth.createUser({ email: emailNorm, password: pin, emailVerified: false });
    newUid = rec.uid;
  } catch (e) {
    if (e && e.code === "auth/email-already-exists") throw new HttpsError("failed-precondition", MSG_REG_GENERICO);
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
      tx.set(db.collection(COL_EVENTOS).doc(evtId), {
        tipo_evento_id: CFG_TEV_LOGIN,
        persona_id: personaId,
        cuenta_id: cuentaId,
        ocurrido_en: FieldValue.serverTimestamp(),
        payload: { fase: "B", motivo: "registro_primer_acceso" },
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
  const prev = userAfter.customClaims && typeof userAfter.customClaims === "object" ? { ...userAfter.customClaims } : {};
  try {
    await auth.setCustomUserClaims(newUid, { ...prev, persona_id: personaId, cuenta_id: cuentaId });
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

module.exports = {
  resolverEmailLoginDni,
  healthV2,
  syncSessionClaims,
  registrarPrimerAcceso,
};

