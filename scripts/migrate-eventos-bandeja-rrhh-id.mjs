import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const ESTADO_PENDIENTE_ID = "cfg_ebr_pend_rev";
const ESTADO_VISTO_ID = "cfg_ebr_visto";
const ESTADO_ARCHIVADO_ID = "cfg_ebr_arch";

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

function resolveEstadoBandejaId(legacyRaw) {
  const legacy = String(legacyRaw || "").trim().toLowerCase();
  if (legacy === "visto") return ESTADO_VISTO_ID;
  if (legacy === "archivado") return ESTADO_ARCHIVADO_ID;
  return ESTADO_PENDIENTE_ID;
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
  console.log(`[migrate:eventos-bandeja] project=${projectId} database=${databaseId || "default"}`);
  const snap = await db.collection("eventos_ticket").get();
  console.log(`[migrate:eventos-bandeja] eventos leidos=${snap.size}`);

  let yaNormalizados = 0;
  let actualizados = 0;
  let sinCambios = 0;
  let batch = db.batch();
  let ops = 0;
  const commits = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const estadoIdActual = String(data.estado_bandeja_rrhh_id || "").trim();
    if (estadoIdActual) {
      yaNormalizados += 1;
      continue;
    }
    const estadoIdNuevo = resolveEstadoBandejaId(data.estado_bandeja_rrhh);
    if (!estadoIdNuevo) {
      sinCambios += 1;
      continue;
    }
    batch.set(
      doc.ref,
      {
        estado_bandeja_rrhh_id: estadoIdNuevo,
      },
      { merge: true },
    );
    ops += 1;
    actualizados += 1;
    if (ops >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) commits.push(batch.commit());
  if (commits.length > 0) await Promise.all(commits);

  console.log(`[migrate:eventos-bandeja] ya_normalizados=${yaNormalizados}`);
  console.log(`[migrate:eventos-bandeja] actualizados=${actualizados}`);
  console.log(`[migrate:eventos-bandeja] sin_cambios=${sinCambios}`);
  console.log("[migrate:eventos-bandeja] OK");
}

main().catch((err) => {
  console.error("[migrate:eventos-bandeja] ERROR", err?.message || err);
  process.exit(1);
});
