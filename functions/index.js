"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

if (!getApps().length) {
  initializeApp();
}

/** Región por defecto para nuevas funciones v2 (alinear con Firestore del hospital si aplica). */
setGlobalOptions({ region: "southamerica-east1" });

/** Comprobación de despliegue / emulador (sin auth). */
exports.healthV2 = onCall(async () => ({
  ok: true,
  proyecto: process.env.GCLOUD_PROJECT || null,
  ts: new Date().toISOString(),
}));

/**
 * Sincroniza custom claims (`persona_id`, `cuenta_id`) según `MODULO_LOGIN_V2.md` §3.3.
 * TODO Fase A.2: leer `usuarios_cuenta` por `auth_uid`, validar estado, `setCustomUserClaims`.
 */
exports.syncSessionClaims = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Se requiere sesión.");
  }
  return {
    ok: true,
    uid: request.auth.uid,
    stub: true,
    mensaje:
      "Stub: implementar lectura Firestore usuarios_cuenta + auth.setCustomUserClaims({ persona_id, cuenta_id }).",
  };
});
