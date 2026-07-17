/**
 * Parche puntual: 64-A sin carga retroactiva (solo -dev).
 *
 * `bloque_workflow_sla_cobertura.permite_retroactividad` → false
 * en la versión publicada de Art. 64-A.
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/patch-64a-retroactividad-dev.mjs --dry-run
 *   node scripts/seed-v2/patch-64a-retroactividad-dev.mjs --apply
 */
import "../load-env-v2.mjs";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb, resolveProjectId } from "../lib/firestoreAdminBootstrap.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";

const ART_64A_ID = "art_01KRNK10V10CH7W5M2W6V558GS";
const CODIGO = "64-A";

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error("Indicá --dry-run o --apply");
  process.exit(1);
}

assertFirestoreSeedAllowed("patch-64a-retroactividad-dev");

const projectId = resolveProjectId();
if (projectId !== "portal-hospital-v2-dev") {
  console.error(`[patch] Abort: project=${projectId} (esperado portal-hospital-v2-dev)`);
  process.exit(1);
}

const db = getAdminDb();

let artId = ART_64A_ID;
const artSnap = await db.collection("cfg_articulos").doc(artId).get();
if (!artSnap.exists) {
  const byCodigo = await db.collection("cfg_articulos").where("codigo", "==", CODIGO).limit(2).get();
  if (byCodigo.empty) {
    console.error(`[patch] no encontrado ${CODIGO}`);
    process.exit(2);
  }
  artId = byCodigo.docs[0].id;
}

const vers = await db
  .collection("cfg_articulos")
  .doc(artId)
  .collection("versiones")
  .where("estado_version_id", "==", "cfg_est_ver_publicada")
  .limit(2)
  .get();

if (vers.empty) {
  console.error(`[patch] sin versión publicada para ${CODIGO} ${artId}`);
  process.exit(2);
}

const verDoc = vers.docs[0];
const verId = verDoc.id;
const data = verDoc.data() || {};
const wf = data.bloque_workflow_sla_cobertura && typeof data.bloque_workflow_sla_cobertura === "object"
  ? data.bloque_workflow_sla_cobertura
  : {};
const actual = wf.permite_retroactividad === true;

const plan = {
  projectId,
  mode: DRY_RUN ? "dry-run" : "apply",
  path: `cfg_articulos/${artId}/versiones/${verId}`,
  permite_retroactividad_antes: actual,
  permite_retroactividad_despues: false,
};

console.log(JSON.stringify(plan, null, 2));

if (DRY_RUN) process.exit(0);

await db
  .collection("cfg_articulos")
  .doc(artId)
  .collection("versiones")
  .doc(verId)
  .set(
    {
      bloque_workflow_sla_cobertura: {
        permite_retroactividad: false,
      },
      patch_64a_retroactividad_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

console.log(`[patch] OK ${CODIGO} permite_retroactividad=false`);
