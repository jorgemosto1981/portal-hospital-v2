/**
 * Seed oleada 63 P2 — cfg_articulos + version publicada.
 *
 * Uso (raiz repo):
 *   node scripts/seed-v2/apply-oleada-63-p2.mjs --dry-run
 *   node scripts/seed-v2/apply-oleada-63-p2.mjs --apply
 */
import "../load-env-v2.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "../lib/firestoreAdminBootstrap.mjs";
import { buildOleada63Documents } from "./lib/buildOleada63Version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const { ulid } = require(join(repoRoot, "functions/node_modules/ulid"));

const SPECS_PATH = join(repoRoot, "docs/v2/seeds/oleada_63_p2/OLEADA_63_P2_SPECS.json");
const APPLIED_PATH = join(repoRoot, "docs/v2/seeds/oleada_63_p2/applied-ids.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.error("Indicá --dry-run o --apply");
  process.exit(1);
}

const specRoot = JSON.parse(readFileSync(SPECS_PATH, "utf8"));
if (!Array.isArray(specRoot.articulos) || !specRoot.articulos.length) {
  console.error("SPECS sin articulos");
  process.exit(1);
}

const schemaMod = await import(
  pathToFileURL(join(repoRoot, "web/src/schemas/articulo.schema.js")).href
);
const { cfgArticuloCoreSchema, cfgArticuloVersionSchema } = schemaMod;

/** @type {Array<{ inciso: string, codigo: string, ok: boolean, errors: string[] }>} */
const report = [];

function mergeArticuloSpec(entry) {
  return {
    ...entry,
    fecha_desde: specRoot.fecha_desde,
    circuito_ingreso_ids: specRoot.circuito_ingreso_ids,
  };
}

function newIds() {
  return { artId: `art_${ulid()}`, verId: `ver_${ulid()}` };
}

function validateBuilt(built) {
  const errors = [];
  const coreRes = cfgArticuloCoreSchema.safeParse(built.core);
  if (!coreRes.success) {
    errors.push(...coreRes.error.issues.map((i) => `core.${i.path.join(".")}: ${i.message}`));
  }
  const verRes = cfgArticuloVersionSchema.safeParse(built.versionForZod);
  if (!verRes.success) {
    errors.push(...verRes.error.issues.map((i) => `version.${i.path.join(".")}: ${i.message}`));
  }
  return errors;
}

let appliedIds = null;
if (existsSync(APPLIED_PATH)) {
  try {
    appliedIds = JSON.parse(readFileSync(APPLIED_PATH, "utf8"));
  } catch {
    appliedIds = null;
  }
}

/** @type {Record<string, { artId: string, verId: string, codigo: string }>} */
const outIds = { ...(appliedIds?.articulos || {}) };

for (const entry of specRoot.articulos) {
  const inciso = String(entry.inciso || entry.codigo);
  const codigo = String(entry.codigo);
  const merged = mergeArticuloSpec(entry);
  const existing = outIds[inciso];
  const ids = existing
    ? { artId: existing.artId, verId: existing.verId }
    : newIds();

  const built = buildOleada63Documents(merged, ids);
  const errors = validateBuilt(built);
  report.push({ inciso, codigo, ok: errors.length === 0, errors });

  if (!errors.length) {
    outIds[inciso] = { artId: built.artId, verId: built.verId, codigo };
  }
}

const zodErrors = report.filter((r) => !r.ok);
console.log(
  JSON.stringify(
    {
      mode: DRY_RUN ? "dry-run" : "apply",
      articulos: report.length,
      zod_errors: zodErrors.length,
      report,
    },
    null,
    2,
  ),
);

if (zodErrors.length) {
  process.exit(2);
}

if (DRY_RUN) {
  process.exit(0);
}

const db = getAdminDb();
const batch = db.batch();
let writes = 0;

for (const entry of specRoot.articulos) {
  const inciso = String(entry.inciso || entry.codigo);
  const codigo = String(entry.codigo);
  const mapped = outIds[inciso];
  if (!mapped) continue;

  const merged = mergeArticuloSpec(entry);
  const built = buildOleada63Documents(merged, {
    artId: mapped.artId,
    verId: mapped.verId,
  });

  const dup = await db.collection("cfg_articulos").where("codigo", "==", codigo).limit(2).get();
  if (!dup.empty) {
    const doc = dup.docs[0];
    if (doc.id !== mapped.artId) {
      console.error(
        `Idempotencia: codigo ${codigo} ya existe como ${doc.id} (esperado ${mapped.artId})`,
      );
      process.exit(3);
    }
    console.log(`[apply] skip existente ${codigo} -> ${doc.id}`);
    continue;
  }

  const coreRef = db.collection("cfg_articulos").doc(mapped.artId);
  const verRef = coreRef.collection("versiones").doc(mapped.verId);
  batch.set(coreRef, {
    ...built.core,
    seed_oleada_63_p2: true,
    seed_oleada_63_p2_aplicado_en: FieldValue.serverTimestamp(),
  });
  batch.set(verRef, {
    ...built.version,
    seed_oleada_63_p2: true,
  });
  writes += 2;
  console.log(`[apply] alta ${codigo} ${mapped.artId} / ${mapped.verId}`);
}

if (writes) {
  await batch.commit();
}

const payload = {
  oleada: "63_p2",
  aplicado_en: new Date().toISOString(),
  articulos: outIds,
};
writeFileSync(APPLIED_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`[apply] applied-ids -> ${APPLIED_PATH} (writes=${writes})`);