/**
 * Dos apps Admin SDK: lectura prod + escritura −dev (nunca al revés).
 */
import { readFileSync } from "node:fs";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export const PROJECT_PROD = "portal-hospital-v2";
export const PROJECT_DEV = "portal-hospital-v2-dev";

const APP_PROD = "sync-v2-prod-read";
const APP_DEV = "sync-v2-dev-write";

/**
 * @param {string} envVar
 * @param {string} expectedProjectId
 */
function loadServiceAccountJson(envVar, expectedProjectId) {
  const path = String(process.env[envVar] || "").trim();
  if (!path) {
    throw new Error(
      `Falta ${envVar} (ruta al JSON de cuenta de servicio; ver .env.v2.local / .env.v2.example).`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${envVar}: no se pudo leer JSON (${err?.message || err}).`);
  }
  const projectId = String(parsed?.project_id || "").trim();
  if (!projectId) {
    throw new Error(`${envVar}: el JSON no tiene project_id.`);
  }
  if (projectId !== expectedProjectId) {
    throw new Error(
      `${envVar}: project_id="${projectId}" pero se esperaba "${expectedProjectId}".`,
    );
  }
  return { path, json: parsed, projectId };
}

/**
 * @param {string} name
 * @param {{ projectId: string; credential: admin.credential.Credential }} options
 */
function getOrInitApp(name, options) {
  const existing = admin.apps.find((a) => a?.name === name);
  if (existing) return existing;
  return admin.initializeApp(options, name);
}

/**
 * Candado: destino **solo** portal-hospital-v2-dev.
 * @returns {{
 *   srcDb: FirebaseFirestore.Firestore;
 *   destDb: FirebaseFirestore.Firestore;
 *   srcProjectId: string;
 *   destProjectId: string;
 * }}
 */
export function initProdReadDevWriteFirestore() {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  const prodSa = loadServiceAccountJson(
    "GOOGLE_APPLICATION_CREDENTIALS_PROD",
    PROJECT_PROD,
  );
  const devSa = loadServiceAccountJson(
    "GOOGLE_APPLICATION_CREDENTIALS_DEV",
    PROJECT_DEV,
  );

  const prodApp = getOrInitApp(APP_PROD, {
    projectId: PROJECT_PROD,
    credential: admin.credential.cert(prodSa.json),
  });
  const devApp = getOrInitApp(APP_DEV, {
    projectId: PROJECT_DEV,
    credential: admin.credential.cert(devSa.json),
  });

  const srcProjectId = String(prodApp.options.projectId || "").trim();
  const destProjectId = String(devApp.options.projectId || "").trim();

  if (srcProjectId !== PROJECT_PROD) {
    throw new Error(`[CANDADO] Origen inválido: ${srcProjectId} (esperado ${PROJECT_PROD}).`);
  }
  if (destProjectId !== PROJECT_DEV) {
    throw new Error(
      `[CANDADO] Destino inválido: ${destProjectId} (esperado ${PROJECT_DEV}). Abortado.`,
    );
  }

  const databaseId = String(process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID || "").trim();
  const dbId =
    databaseId && databaseId !== "default" && databaseId !== "(default)"
      ? databaseId
      : undefined;

  const srcDb = dbId ? getFirestore(prodApp, dbId) : getFirestore(prodApp);
  const destDb = dbId ? getFirestore(devApp, dbId) : getFirestore(devApp);

  return { srcDb, destDb, srcProjectId, destProjectId };
}
