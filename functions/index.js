"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

/** Región por defecto para nuevas funciones v2 (alinear con Firestore del hospital si aplica). */
setGlobalOptions({ region: "southamerica-east1" });

const COL_USUARIOS_CUENTA = "usuarios_cuenta";

/** Comprobación de despliegue / emulador (sin auth). */
exports.healthV2 = onCall(async () => ({
  ok: true,
  proyecto: process.env.GCLOUD_PROJECT || null,
  ts: new Date().toISOString(),
}));

/**
 * Sincroniza custom claims (`persona_id`, `cuenta_id`) desde `usuarios_cuenta` según `MODULO_LOGIN_V2.md` §3.3.
 * - `cuenta_id` = id del documento (`usr_<ULID>`).
 * - Requiere `auth_uid` en el documento igual al UID de la sesión y no nulo.
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

  const doc = snap.docs[0];
  const cuentaId = doc.id;
  const data = doc.data() || {};
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

  /** Los custom claims reemplazan el objeto completo en Auth; solo ids de sesión V2. */
  await auth.setCustomUserClaims(uid, {
    persona_id: personaId,
    cuenta_id: cuentaId,
  });

  return {
    ok: true,
    persona_id: personaId,
    cuenta_id: cuentaId,
  };
});
