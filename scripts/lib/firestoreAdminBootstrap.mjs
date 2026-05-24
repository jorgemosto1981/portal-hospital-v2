/**
 * Inicializa Firestore Admin (V2) desde .env.v2.local.
 */
import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export function resolveProjectId() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!credPath) return null;
  try {
    const parsed = JSON.parse(readFileSync(credPath, "utf8"));
    return parsed?.project_id || null;
  } catch {
    return null;
  }
}

export function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw || raw === "default" || raw === "(default)") return undefined;
  return raw;
}

/** @returns {FirebaseFirestore.Firestore} */
export function getAdminDb() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!admin.apps.length) {
    const projectId = resolveProjectId();
    if (!projectId) {
      throw new Error("Definí FIREBASE_V2_PROJECT_ID o credencial con project_id.");
    }
    admin.initializeApp({
      projectId,
      credential: admin.credential.applicationDefault(),
    });
  }

  const databaseId = resolveNonDefaultDatabaseId();
  return databaseId ? getFirestore(admin.app(), databaseId) : getFirestore(admin.app());
}
