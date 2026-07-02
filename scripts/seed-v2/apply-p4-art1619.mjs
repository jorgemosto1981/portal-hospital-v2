/**
 * Seed P4.4 — Arts. 16/19 licencia médica larga (cfg_articulos + versión publicada).
 *
 * Uso (raíz repo):
 *   node scripts/seed-v2/apply-p4-art1619.mjs --dry-run
 *   node scripts/seed-v2/apply-p4-art1619.mjs --apply
 *   node scripts/seed-v2/apply-p4-art1619.mjs --apply --reapply
 */
import "../load-env-v2.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "../lib/firestoreAdminBootstrap.mjs";
import { buildP4LicenciaMedicaLargaDocuments } from "./lib/buildP4LicenciaMedicaLargaVersion.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const { ulid } = require(join(repoRoot, "functions/node_modules/ulid"));

const SPECS_PATH = join(repoRoot, "docs/v2/seeds/p4_art1619/ART16_19_P44_SPECS.json");
const APPLIED_PATH = join(repoRoot, "docs/v2/seeds/p4_art1619/applied-ids.json");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");
const REAPPLY = process.argv.includes("--reapply");

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

/** @type {Array<{ clave: string, codigo: string, ok: boolean, errors: string[] }>} */
const report = [];

function mergeSpec(entry) {
  return {
    ...entry,
    fecha_desde: specRoot.fecha_desde,
    circuito_ingreso_ids: specRoot.circuito_ingreso_ids,
  };
}

function newIds() {
  return { artId: `art_${ulid()}`, verId: `ver_${ulid()}` };
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
  const clave = String(entry.clave || entry.codigo);
  const codigo = String(entry.codigo);
  const merged = mergeSpec(entry);
  const existing = outIds[clave];
  const ids = existing ? { artId: existing.artId, verId: existing.verId } : newIds();

  const built = buildP4LicenciaMedicaLargaDocuments(merged, ids);
  const errors = [];
  const coreRes = cfgArticuloCoreSchema.safeParse(built.core);
  if (!coreRes.success) {
    errors.push(...coreRes.error.issues.map((i) => `core.${i.path.join(".")}: ${i.message}`));
  }
  const verRes = cfgArticuloVersionSchema.safeParse(built.version);
  if (!verRes.success) {
    errors.push(...verRes.error.issues.map((i) => `version.${i.path.join(".")}: ${i.message}`));
  }
  report.push({ clave, codigo, ok: errors.length === 0, errors });

  if (!errors.length) {
    outIds[clave] = { artId: built.artId, verId: built.verId, codigo };
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
      ids: outIds,
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
  const clave = String(entry.clave || entry.codigo);
  const codigo = String(entry.codigo);
  const mapped = outIds[clave];
  if (!mapped) continue;

  const merged = mergeSpec(entry);
  const built = buildP4LicenciaMedicaLargaDocuments(merged, {
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
    if (REAPPLY) {
      const coreRef = db.collection("cfg_articulos").doc(mapped.artId);
      const verRef = coreRef.collection("versiones").doc(mapped.verId);
      batch.set(
        coreRef,
        {
          ...built.core,
          seed_p4_art1619: true,
          seed_p4_art1619_reaplicado_en: FieldValue.serverTimestamp(),
          ayuda_agente_ui: entry.ayuda_agente_ui || null,
        },
        { merge: true },
      );
      batch.set(verRef, {
        ...built.version,
        seed_p4_art1619: true,
        seed_p4_art1619_reaplicado_en: FieldValue.serverTimestamp(),
      });
      writes += 2;
      console.log(`[apply] reapply ${codigo} ${mapped.artId} / ${mapped.verId}`);
      continue;
    }
    console.log(`[apply] skip existente ${codigo} -> ${doc.id}`);
    continue;
  }

  const coreRef = db.collection("cfg_articulos").doc(mapped.artId);
  const verRef = coreRef.collection("versiones").doc(mapped.verId);
  batch.set(coreRef, {
    ...built.core,
    seed_p4_art1619: true,
    seed_p4_art1619_aplicado_en: FieldValue.serverTimestamp(),
    ayuda_agente_ui: entry.ayuda_agente_ui || null,
  });
  batch.set(verRef, {
    ...built.version,
    seed_p4_art1619: true,
  });
  writes += 2;
  console.log(`[apply] alta ${codigo} ${mapped.artId} / ${mapped.verId}`);
}

if (writes) {
  await batch.commit();
}

const payload = {
  oleada: specRoot.oleada,
  aplicado_en: new Date().toISOString(),
  articulos: outIds,
};
writeFileSync(APPLIED_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[apply] applied-ids -> ${APPLIED_PATH} (writes=${writes})`);
