/**
 * Parche puntual: modo_resolucion_jefe en versiones publicadas (solo -dev).
 *
 * 63-* → toma_conocimiento (IDs de docs/v2/seeds/oleada_63_p2/applied-ids.json)
 * 64-A / 64-B → autorizacion (por codigo en cfg_articulos)
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/patch-modo-resolucion-jefe-dev.mjs --dry-run
 *   node scripts/seed-v2/patch-modo-resolucion-jefe-dev.mjs --apply
 */
import "../load-env-v2.mjs";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb, resolveProjectId } from "../lib/firestoreAdminBootstrap.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const APPLIED_PATH = join(repoRoot, "docs/v2/seeds/oleada_63_p2/applied-ids.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error("Indicá --dry-run o --apply");
  process.exit(1);
}

assertFirestoreSeedAllowed("patch-modo-resolucion-jefe-dev");

const projectId = resolveProjectId();
if (projectId !== "portal-hospital-v2-dev") {
  console.error(`[patch] Abort: project=${projectId} (esperado portal-hospital-v2-dev)`);
  process.exit(1);
}

if (!existsSync(APPLIED_PATH)) {
  console.error(`[patch] Falta ${APPLIED_PATH}`);
  process.exit(1);
}

const applied = JSON.parse(readFileSync(APPLIED_PATH, "utf8"));
const articulos63 = applied?.articulos && typeof applied.articulos === "object" ? applied.articulos : {};

const db = getAdminDb();
/** @type {Array<{ kind: string, path: string, modo: string }>} */
const plan = [];

for (const row of Object.values(articulos63)) {
  const artId = String(row?.artId || "").trim();
  const verId = String(row?.verId || "").trim();
  const codigo = String(row?.codigo || "").trim();
  if (!/^art_/i.test(artId) || !/^ver_/i.test(verId)) continue;
  plan.push({
    kind: `63:${codigo}`,
    path: `cfg_articulos/${artId}/versiones/${verId}`,
    modo: "toma_conocimiento",
    artId,
    verId,
  });
}

for (const codigo of ["64-A", "64-B"]) {
  const snap = await db.collection("cfg_articulos").where("codigo", "==", codigo).limit(2).get();
  if (snap.empty) {
    console.warn(`[patch] no encontrado codigo=${codigo}`);
    continue;
  }
  if (snap.size > 1) {
    console.warn(`[patch] varios docs codigo=${codigo}; usamos ${snap.docs[0].id}`);
  }
  const artId = snap.docs[0].id;
  const vers = await db
    .collection("cfg_articulos")
    .doc(artId)
    .collection("versiones")
    .where("estado_version_id", "==", "cfg_est_ver_publicada")
    .limit(2)
    .get();
  if (vers.empty) {
    console.warn(`[patch] sin version publicada para ${codigo} ${artId}`);
    continue;
  }
  plan.push({
    kind: `64:${codigo}`,
    path: `cfg_articulos/${artId}/versiones/${vers.docs[0].id}`,
    modo: "autorizacion",
    artId,
    verId: vers.docs[0].id,
  });
}

console.log(JSON.stringify({ projectId, mode: DRY_RUN ? "dry-run" : "apply", plan }, null, 2));

if (DRY_RUN) process.exit(0);

const batch = db.batch();
let writes = 0;
for (const item of plan) {
  const ref = db.collection("cfg_articulos").doc(item.artId).collection("versiones").doc(item.verId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`[patch] falta doc ${item.path}`);
    process.exit(3);
  }
  batch.set(
    ref,
    {
      bloque_workflow_sla_cobertura: {
        modo_resolucion_jefe: item.modo,
      },
      patch_modo_resolucion_jefe_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  writes += 1;
  console.log(`[patch] ${item.kind} → ${item.modo}`);
}

await batch.commit();
console.log(`[patch] OK writes=${writes}`);
