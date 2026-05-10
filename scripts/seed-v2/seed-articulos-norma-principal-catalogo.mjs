/**
 * Seed **solo** `cfg_tipo_norma_principal_articulo` (normativa principal citada en cfg_articulos).
 *
 * Política: `ALLOW_FIRESTORE_SEED_V2=true`
 *
 * Uso (raíz del repo):
 *   ALLOW_FIRESTORE_SEED_V2=true npm run seed:articulos-norma-principal-catalogo
 */

import "../load-env-v2.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import { cfgTipoNormaPrincipalArticulo } from "./normaPrincipalArticuloCatalogos.data.mjs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

assertFirestoreSeedAllowed("seed-articulos-norma-principal-catalogo");

const __dirname = dirname(fileURLToPath(import.meta.url));

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error(
    "Falta GOOGLE_APPLICATION_CREDENTIALS (JSON de cuenta de servicio con acceso a Firestore V2).",
  );
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch (e) {
    console.error("[seed-articulos-norma-principal] No se pudo leer project_id del JSON:", e?.message);
  }
  return null;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o usá JSON de servicio con `project_id`.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw) return undefined;
  if (raw === "default" || raw === "(default)") return undefined;
  return raw;
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId
  ? getFirestore(getApp(), nonDefaultDatabaseId)
  : getFirestore();

function applyBatch(items, col) {
  if (!items || items.length === 0) return Promise.resolve();
  const b = db.batch();
  for (const { id, data } of items) {
    b.set(db.collection(col).doc(id), data, { merge: true });
  }
  return b.commit();
}

async function main() {
  const app = getApp();
  const projectId = app.options?.projectId || "desconocido";
  const dbLabel = nonDefaultDatabaseId
    ? `named=${nonDefaultDatabaseId}`
    : "default (getFirestore sin 2.º id)";
  console.log(`[seed-articulos-norma-principal] project=${projectId} database=${dbLabel}`);

  const COL = "cfg_tipo_norma_principal_articulo";
  await applyBatch(cfgTipoNormaPrincipalArticulo(), COL);

  const out = {
    projectId,
    generado: new Date().toISOString(),
    colecciones: [COL],
    [COL]: cfgTipoNormaPrincipalArticulo().map((x) => x.id),
  };

  const outPath = join(__dirname, "seed-articulos-norma-principal-catalogo.ids.json");
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[seed-articulos-norma-principal] ok — ids en ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
