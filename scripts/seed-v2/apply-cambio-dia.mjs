/**
 * Seed CAMBIO-DIA — cfg_articulos + version publicada.
 *
 * Uso (raiz repo):
 *   node scripts/seed-v2/apply-cambio-dia.mjs --dry-run
 *   node scripts/seed-v2/apply-cambio-dia.mjs --apply
 *   node scripts/seed-v2/apply-cambio-dia.mjs --apply --reapply
 */
import "../load-env-v2.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "../lib/firestoreAdminBootstrap.mjs";
import { buildCambioDiaDocuments } from "./lib/buildCambioDiaVersion.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const { ulid } = require(join(repoRoot, "functions/node_modules/ulid"));

const SPECS_PATH = join(repoRoot, "docs/v2/seeds/cambio_dia/CAMBIO_DIA_SPECS.json");
const APPLIED_PATH = join(repoRoot, "docs/v2/seeds/cambio_dia/applied-ids.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");
const REAPPLY = process.argv.includes("--reapply");

if (!DRY_RUN && !APPLY) {
  console.error("Indicá --dry-run o --apply");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(SPECS_PATH, "utf8"));
const codigo = String(spec.codigo || "CAMBIO-DIA");

const schemaMod = await import(
  pathToFileURL(join(repoRoot, "web/src/schemas/articulo.schema.js")).href
);
const { cfgArticuloCoreSchema, cfgArticuloVersionSchema } = schemaMod;

function newIds() {
  return { artId: `art_${ulid()}`, verId: `ver_${ulid()}` };
}

function validateBuilt(built) {
  const errors = [];
  const coreRes = cfgArticuloCoreSchema.safeParse(built.core);
  if (!coreRes.success) {
    errors.push(...coreRes.error.issues.map((i) => `core.${i.path.join(".")}: ${i.message}`));
  }
  const verRes = cfgArticuloVersionSchema.safeParse(built.version);
  if (!verRes.success) {
    errors.push(...verRes.error.issues.map((i) => `version.${i.path.join(".")}: ${i.message}`));
  }
  return errors;
}

let applied = null;
if (existsSync(APPLIED_PATH)) {
  try {
    applied = JSON.parse(readFileSync(APPLIED_PATH, "utf8"));
  } catch {
    applied = null;
  }
}

const ids =
  applied?.artId && applied?.verId
    ? { artId: applied.artId, verId: applied.verId }
    : newIds();

const built = buildCambioDiaDocuments(spec, ids);
const errors = validateBuilt(built);

console.log(
  JSON.stringify(
    {
      mode: DRY_RUN ? "dry-run" : "apply",
      codigo,
      artId: built.artId,
      verId: built.verId,
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
const coreRef = db.collection("cfg_articulos").doc(built.artId);
const verRef = coreRef.collection("versiones").doc(built.verId);

const dup = await db.collection("cfg_articulos").where("codigo", "==", codigo).limit(2).get();
if (!dup.empty) {
  const doc = dup.docs[0];
  if (doc.id !== built.artId) {
    console.error(`Idempotencia: codigo ${codigo} ya existe como ${doc.id}`);
    process.exit(3);
  }
  if (!REAPPLY) {
    console.log(`[apply] skip existente ${codigo} -> ${doc.id}`);
    writeFileSync(
      APPLIED_PATH,
      JSON.stringify(
        {
          articulo: "cambio_dia",
          aplicado_en: applied?.aplicado_en || new Date().toISOString(),
          artId: built.artId,
          verId: built.verId,
          codigo,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    process.exit(0);
  }
}

await coreRef.set(
  {
    ...built.core,
    seed_cambio_dia: true,
    seed_cambio_dia_aplicado_en: FieldValue.serverTimestamp(),
  },
  { merge: true },
);
await verRef.set({
  ...built.version,
  seed_cambio_dia: true,
});

writeFileSync(
  APPLIED_PATH,
  JSON.stringify(
    {
      articulo: "cambio_dia",
      aplicado_en: new Date().toISOString(),
      artId: built.artId,
      verId: built.verId,
      codigo,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
console.log(`[apply] OK ${codigo} ${built.artId} / ${built.verId}`);
console.log(`[apply] Recordá agregar artId a cfg_etapa1/runtime.articulo_ids_etapa1`);
