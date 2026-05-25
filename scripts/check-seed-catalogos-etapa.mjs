import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertFirestoreSeedAllowed } from "./seed-v2/guard-no-seed.mjs";

function loadLocalEnvIfPresent() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env.v2.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveProjectId(credPath) {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    return null;
  }
  return null;
}

loadLocalEnvIfPresent();

assertFirestoreSeedAllowed("check-seed-catalogos-etapa");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

if (!admin.apps.length) {
  const projectId = resolveProjectId(credPath);
  if (!projectId) {
    console.error("No se pudo resolver FIREBASE project id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(getApp());
const now = new Date().toISOString();

const seeds = {
  cfg_pais: [
    { id: "CFG_PAIS_AR", nombre: "Argentina", activo: true, codigo: "AR" },
  ],
  cfg_especialidad: [
    { id: "CFG_ESP_GENERAL", nombre: "General", activo: true },
  ],
  cfg_colegio: [
    { id: "CFG_COL_SIN_COLEGIO", nombre: "Sin colegio declarado", activo: true },
  ],
  cfg_jurisdiccion_matricula: [
    { id: "CFG_JUR_NAC", nombre: "Nacional", activo: true },
  ],
  cfg_tipo_acto_designacion: [
    { id: "CFG_ACT_RESOLUCION", nombre: "Resolución", activo: true },
  ],
};

const report = {};
for (const [collectionName, docs] of Object.entries(seeds)) {
  const countSnap = await db.collection(collectionName).limit(1).get();
  report[collectionName] = {
    existedWithDocs: !countSnap.empty,
    inserted: [],
  };
  for (const doc of docs) {
    const ref = db.collection(collectionName).doc(doc.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        ...doc,
        creado_en: now,
        actualizado_en: now,
        schema_version: 1,
      });
      report[collectionName].inserted.push(doc.id);
    }
  }
}

console.log(JSON.stringify(report, null, 2));
