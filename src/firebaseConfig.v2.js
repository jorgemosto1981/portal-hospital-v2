import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import { createLogger } from "./utils/logger";

const log = createLogger("firebaseConfig.v2");

/** Nombre de app secundaria: evita colisionar con la instancia default de V1 (`firebaseConfig.js`). */
const V2_APP_NAME = "portal-hospital-v2";

const V2_ENV_NAMES = [
  "VITE_V2_FIREBASE_API_KEY",
  "VITE_V2_FIREBASE_AUTH_DOMAIN",
  "VITE_V2_FIREBASE_PROJECT_ID",
  "VITE_V2_FIREBASE_STORAGE_BUCKET",
  "VITE_V2_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_V2_FIREBASE_APP_ID",
];

/**
 * Configuración del proyecto **portal-hospital-v2** (Web SDK).
 * Siempre contra Firebase en la nube (Firestore, Storage, Auth).
 * Variables: `VITE_V2_FIREBASE_*` (ver `.env.v2.example`).
 */
function buildFirebaseConfigV2() {
  const config = {
    apiKey: import.meta.env.VITE_V2_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_V2_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_V2_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_V2_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_V2_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_V2_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_V2_FIREBASE_MEASUREMENT_ID,
  };

  const missing = V2_ENV_NAMES.filter((name) => !import.meta.env[name]);
  if (missing.length > 0) {
    const msg =
      `Faltan variables de entorno V2: ${missing.join(", ")}. ` +
      "En la raíz de `portal-hospital-v2`, copiá `.env.v2.example` a `.env.v2.local` e integrá con Vite (p. ej. en `../portal-hospital-v1/portal-hospital/`: ver README de V2).";
    log.error(msg);
    throw new Error(msg);
  }

  return config;
}

const firebaseConfigV2 = buildFirebaseConfigV2();

const appV2 = getApps().some((a) => a.name === V2_APP_NAME)
  ? getApp(V2_APP_NAME)
  : initializeApp(firebaseConfigV2, V2_APP_NAME);

const dbV2 = getFirestore(appV2);
const authV2 = getAuth(appV2);
const storageV2 = getStorage(appV2);
authV2.languageCode = "es";

/** Analytics solo en navegador; puede quedar null si no hay `measurementId` o no hay soporte. */
let analyticsV2 = null;
if (import.meta.env.VITE_V2_FIREBASE_MEASUREMENT_ID) {
  isSupported()
    .then((ok) => {
      if (ok) {
        try {
          analyticsV2 = getAnalytics(appV2);
        } catch (e) {
          log.warn("getAnalytics V2 no disponible:", e);
        }
      }
    })
    .catch(() => {});
}

export { appV2, dbV2, authV2, storageV2, analyticsV2, V2_APP_NAME, firebaseConfigV2 };
