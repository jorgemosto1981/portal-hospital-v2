/**
 * Seed Art. 77-0 — cfg_articulos + versión publicada.
 *
 * Uso (PowerShell, solo -dev en átomo 1):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/apply-art-77-0.mjs --dry-run
 *   node scripts/seed-v2/apply-art-77-0.mjs --apply
 *   node scripts/seed-v2/apply-art-77-0.mjs --apply --reapply
 *
 * @see docs/v2/RFC_ART_77_0_INASISTENCIA_INJUSTIFICADA_V2.md
 */
import "../load-env-v2.mjs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb, resolveProjectId } from "../lib/firestoreAdminBootstrap.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import { buildArt770Documents } from "./lib/buildArt770Version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const { ulid } = require(join(repoRoot, "functions/node_modules/ulid"));

const APPLIED_DIR = join(repoRoot, "docs/v2/seeds/art_77_0");
const APPLIED_PATH = join(APPLIED_DIR, "applied-ids.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");
const REAPPLY = process.argv.includes("--reapply");
const ALLOW_PROD = process.argv.includes("--allow-prod");

if (!DRY_RUN && !APPLY) {
  console.error("Indicá --dry-run o --apply");
  process.exit(1);
}

assertFirestoreSeedAllowed("apply-art-77-0");

const projectId = resolveProjectId();
if (projectId !== "portal-hospital-v2-dev" && !ALLOW_PROD) {
  console.error(
    `[art-77-0] Abort: project=${projectId}. Esperado portal-hospital-v2-dev (o --allow-prod con acta).`,
  );
  process.exit(1);
}

const schemaMod = await import(
  pathToFileURL(join(repoRoot, "web/src/schemas/articulo.schema.js")).href
);
const { cfgArticuloCoreSchema, cfgArticuloVersionSchema } = schemaMod;

const spec = {
  codigo: "77-0",
  nombre: "INASISTENCIA INJUSTIFICADA",
  inciso_normativo: "Ley 8525/79 art. 53.a — inasistencias injustificadas",
  codigo_grilla: "77-0",
  color_ui: "#B91C1C",
  fecha_desde: "2026-01-01",
  circuito_ingreso_ids: ["CFG_RRHH"],
  umbral_inasistencias_injustificadas_dias: 10,
  ventana_acumulado_meses: 12,
};

let applied = null;
if (existsSync(APPLIED_PATH)) {
  try {
    applied = JSON.parse(readFileSync(APPLIED_PATH, "utf8"));
  } catch {
    applied = null;
  }
}

const artId = applied?.artId || `art_${ulid()}`;
const verId = applied?.verId || `ver_${ulid()}`;
const built = buildArt770Documents(spec, { artId, verId });

const errors = [];
const coreRes = cfgArticuloCoreSchema.safeParse(built.core);
if (!coreRes.success) {
  errors.push(...coreRes.error.issues.map((i) => `core.${i.path.join(".")}: ${i.message}`));
}
const verRes = cfgArticuloVersionSchema.safeParse(built.version);
if (!verRes.success) {
  errors.push(...verRes.error.issues.map((i) => `version.${i.path.join(".")}: ${i.message}`));
}

console.log(
  JSON.stringify(
    {
      mode: DRY_RUN ? "dry-run" : "apply",
      projectId,
      artId,
      verId,
      zod_ok: errors.length === 0,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exit(2);
if (DRY_RUN) process.exit(0);

const db = getAdminDb();
const dup = await db.collection("cfg_articulos").where("codigo", "==", "77-0").limit(2).get();
if (!dup.empty) {
  const doc = dup.docs[0];
  if (doc.id !== artId) {
    console.error(`[art-77-0] codigo 77-0 ya existe como ${doc.id} (esperado ${artId})`);
    process.exit(3);
  }
  if (!REAPPLY) {
    console.log(`[art-77-0] skip existente ${doc.id} (usá --reapply para pisar versión)`);
    process.exit(0);
  }
}

const coreRef = db.collection("cfg_articulos").doc(artId);
const verRef = coreRef.collection("versiones").doc(verId);
const batch = db.batch();
batch.set(
  coreRef,
  {
    ...built.core,
    seed_art_77_0: true,
    seed_art_77_0_en: FieldValue.serverTimestamp(),
  },
  { merge: true },
);
batch.set(verRef, {
  ...built.version,
  seed_art_77_0: true,
  seed_art_77_0_en: FieldValue.serverTimestamp(),
});
await batch.commit();

mkdirSync(APPLIED_DIR, { recursive: true });
const payload = {
  codigo: "77-0",
  project_hint: projectId,
  aplicado_en: new Date().toISOString(),
  artId,
  verId,
};
writeFileSync(APPLIED_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`[art-77-0] OK ${artId} / ${verId} → ${APPLIED_PATH}`);
