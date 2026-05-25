/**
 * Borra un documento en `eventos_ticket` por id (Admin SDK).
 * Uso: node scripts/delete-evento-ticket-by-id.v2.mjs evt_<ULID>
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const eventId = process.argv[2]?.trim();
if (!eventId) {
  console.error("Uso: node scripts/delete-evento-ticket-by-id.v2.mjs evt_<ULID>");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    return j.project_id || null;
  } catch {
    return null;
  }
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw || raw === "default" || raw === "(default)") return undefined;
  return raw;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error("[delete-evento] No se pudo resolver FIREBASE_V2_PROJECT_ID / credentials.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const databaseId = resolveNonDefaultDatabaseId();
const db = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore();

const ref = db.collection("eventos_ticket").doc(eventId);
const snap = await ref.get();
if (!snap.exists) {
  console.log(`[delete-evento] No existe: ${eventId}`);
  process.exit(0);
}

await ref.delete();
console.log(`[delete-evento] OK eliminado ${eventId}`);
