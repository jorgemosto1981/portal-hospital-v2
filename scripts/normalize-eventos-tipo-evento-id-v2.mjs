import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const NORMALIZE_MAP = {
  CFG_TEV_LOGIN: "EVT_LOGIN",
  CFG_TEV_DDJJ_OMITIDA: "EVT_DATOS_NOTIF_CAMBIO_DDJJ",
};

function resolveProjectId() {
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

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw || raw === "default" || raw === "(default)") return undefined;
  return raw;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error(
    "No se pudo resolver projectId. Definí FIREBASE_V2_PROJECT_ID o GOOGLE_APPLICATION_CREDENTIALS válido.",
  );
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

async function main() {
  console.log(`[normalize:eventos-tipo-id] project=${projectId} database=${databaseId || "default"}`);
  const snap = await db.collection("eventos_ticket").get();
  console.log(`[normalize:eventos-tipo-id] eventos_leidos=${snap.size}`);
  let normalizados = 0;
  let sinCambio = 0;
  let batch = db.batch();
  let ops = 0;
  const commits = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const raw = String(d.tipo_evento_id || "").trim().toUpperCase();
    const next = NORMALIZE_MAP[raw];
    if (!next || next === raw) {
      sinCambio += 1;
      continue;
    }
    batch.set(doc.ref, { tipo_evento_id: next }, { merge: true });
    normalizados += 1;
    ops += 1;
    if (ops >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) commits.push(batch.commit());
  if (commits.length > 0) await Promise.all(commits);

  console.log(`[normalize:eventos-tipo-id] normalizados=${normalizados}`);
  console.log(`[normalize:eventos-tipo-id] sin_cambio=${sinCambio}`);
  console.log("[normalize:eventos-tipo-id] OK");
}

main().catch((err) => {
  console.error("[normalize:eventos-tipo-id] ERROR", err?.message || err);
  process.exit(1);
});
