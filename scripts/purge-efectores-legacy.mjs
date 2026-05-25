/**
 * Elimina todos los documentos de la colección legacy `efectores` (no cumplía el esquema cfg_*).
 * Uso: npm run db:purge-efectores-legacy
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (o carga vía .env.v2.local).");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch (e) {
    console.error("[purge-efectores-legacy]", e?.message);
  }
  return null;
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw) return undefined;
  if (raw === "default" || raw === "(default)") return undefined;
  return raw;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o un JSON con project_id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId
  ? getFirestore(getApp(), nonDefaultDatabaseId)
  : getFirestore();

const COL = "efectores";
const CHUNK = 450;

try {
  const snap = await db.collection(COL).get();
  if (snap.empty) {
    console.log(`[purge-efectores-legacy] La colección "${COL}" ya está vacía o no existía.`);
    process.exit(0);
  }

  const refs = snap.docs.map((d) => d.ref);
  let n = 0;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + CHUNK)) {
      batch.delete(r);
    }
    await batch.commit();
    n += Math.min(CHUNK, refs.length - i);
  }

  console.log(
    `[purge-efectores-legacy] Eliminados ${n} documento(s) de "${COL}" (proyecto ${getApp().options?.projectId}).`,
  );
} catch (e) {
  console.error("[purge-efectores-legacy]", e?.message || e);
  process.exit(1);
}
