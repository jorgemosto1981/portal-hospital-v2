import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

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
  console.log(`[delete:eventos-sin-ids] project=${projectId} database=${databaseId || "default"}`);
  const snap = await db.collection("eventos_ticket").get();
  console.log(`[delete:eventos-sin-ids] eventos_leidos=${snap.size}`);

  let conservados = 0;
  let eliminados = 0;
  let batch = db.batch();
  let ops = 0;
  const commits = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const tipoCfg = String(d.tipo_evento_cfg_id || "").trim();
    const estadoCfg = String(d.estado_bandeja_rrhh_id || "").trim();
    if (tipoCfg && estadoCfg) {
      conservados += 1;
      continue;
    }
    batch.delete(doc.ref);
    eliminados += 1;
    ops += 1;
    if (ops >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) commits.push(batch.commit());
  if (commits.length > 0) await Promise.all(commits);

  console.log(`[delete:eventos-sin-ids] conservados=${conservados}`);
  console.log(`[delete:eventos-sin-ids] eliminados=${eliminados}`);
  console.log("[delete:eventos-sin-ids] OK");
}

main().catch((err) => {
  console.error("[delete:eventos-sin-ids] ERROR", err?.message || err);
  process.exit(1);
});
