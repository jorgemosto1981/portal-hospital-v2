/**
 * Seed catálogos RFC 1919 (situación revista, unidad intervalo, pasos workflow).
 * Política: `ALLOW_FIRESTORE_SEED_V2=true`.
 *
 * Ampliaciones en cfg_accion_vencimiento / cfg_politica_superposición:
 * usar también `seed:articulos-plazos-catalogos` y `seed:articulos-workflow-catalogos`.
 *
 * Uso: ALLOW_FIRESTORE_SEED_V2=true npm run seed:articulos-1919-catalogos
 */

import "../load-env-v2.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import {
  cfgPasoWorkflowArticulo,
  cfgSituacionRevista,
  cfgUnidadIntervaloTiempo,
} from "./articulos1919Catalogos.data.mjs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

assertFirestoreSeedAllowed("seed-articulos-1919-catalogos");

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
    console.error("[seed-articulos-1919] No se pudo leer project_id del JSON:", e?.message);
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
  console.log(`[seed-articulos-1919] project=${projectId} database=${dbLabel}`);

  await applyBatch(cfgSituacionRevista(), "cfg_situacion_revista");
  await applyBatch(cfgUnidadIntervaloTiempo(), "cfg_unidad_intervalo_tiempo");
  await applyBatch(cfgPasoWorkflowArticulo(), "cfg_paso_workflow_articulo");

  const out = {
    projectId,
    generado: new Date().toISOString(),
    colecciones: [
      "cfg_situacion_revista",
      "cfg_unidad_intervalo_tiempo",
      "cfg_paso_workflow_articulo",
    ],
    cfg_situacion_revista: cfgSituacionRevista().map((x) => x.id),
    cfg_unidad_intervalo_tiempo: cfgUnidadIntervaloTiempo().map((x) => x.id),
    cfg_paso_workflow_articulo: cfgPasoWorkflowArticulo().map((x) => x.id),
  };

  const outPath = join(__dirname, "seed-articulos-1919-catalogos.ids.json");
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[seed-articulos-1919] ok — ids en ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
