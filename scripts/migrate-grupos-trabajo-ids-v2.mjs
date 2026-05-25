/**
 * Migra IDs legacy de `grupos_de_trabajo` desde `GT_*` a `gdt_<ULID>`.
 * También actualiza referencias en:
 * - historial_laboral_grupos.grupo_de_trabajo_id
 * - historial_laboral_cargos.grupo_de_trabajo_id (si existiera)
 * - personas.grupo_de_trabajo_id (si existiera)
 * - grupos_de_trabajo.parent_group_id
 *
 * Uso:
 *   node scripts/migrate-grupos-trabajo-ids-v2.mjs --dry-run
 *   node scripts/migrate-grupos-trabajo-ids-v2.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY_RUN = !APPLY;
const CHUNK = 400;
const RX_GDT_V2 = /^gdt_[0-9A-HJKMNP-TV-Z]{26}$/;
const RX_GT_LEGACY = /^GT_[A-Z0-9_]+$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function loadLocalEnvIfPresent() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env.v2.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
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

loadLocalEnvIfPresent();

function encodeBase32(num, len) {
  let n = num;
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out = CROCKFORD[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

function makeUlidLike() {
  const time = Date.now();
  const timePart = encodeBase32(time, 10);
  const rnd = randomBytes(16);
  let randPart = "";
  for (let i = 0; i < 16; i += 1) {
    randPart += CROCKFORD[rnd[i] % 32];
  }
  return `${timePart}${randPart}`;
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (o carga vía .env.v2.local).");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    // noop
  }
  return null;
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw) return undefined;
  if (raw === "default" || raw === "(default)") return undefined;
  return raw;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o un JSON con project_id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId ? getFirestore(getApp(), nonDefaultDatabaseId) : getFirestore();

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function commitOps(ops) {
  for (const batchOps of chunk(ops, CHUNK)) {
    const batch = db.batch();
    for (const op of batchOps) {
      if (op.type === "set") batch.set(op.ref, op.data, op.options || {});
      if (op.type === "update") batch.update(op.ref, op.data);
      if (op.type === "delete") batch.delete(op.ref);
    }
    await batch.commit();
  }
}

const gruposSnap = await db.collection("grupos_de_trabajo").get();
const groups = gruposSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));

const mapping = new Map();
const unsupported = [];
const usedIds = new Set(groups.map((g) => g.id));

for (const g of groups) {
  if (RX_GDT_V2.test(g.id)) continue;
  if (RX_GT_LEGACY.test(g.id)) {
    let next = `gdt_${makeUlidLike()}`;
    while (usedIds.has(next)) next = `gdt_${makeUlidLike()}`;
    usedIds.add(next);
    mapping.set(g.id, next);
    continue;
  }
  unsupported.push(g.id);
}

const summary = {
  mode: DRY_RUN ? "dry-run" : "apply",
  total_grupos: groups.length,
  legacy_gt_detectados: mapping.size,
  ids_no_soportados: unsupported,
  mapping: Object.fromEntries(mapping.entries()),
  updated_refs: {
    historial_laboral_grupos: 0,
    historial_laboral_cargos: 0,
    personas: 0,
    grupos_parent_group_id: 0,
  },
};

if (unsupported.length) {
  console.error("[migrate-grupos-trabajo-ids-v2] IDs no soportados detectados:", unsupported);
  process.exit(1);
}

if (mapping.size === 0) {
  console.log(JSON.stringify({ ...summary, message: "No hay IDs GT_* para migrar." }, null, 2));
  process.exit(0);
}

if (DRY_RUN) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const ops = [];

// 1) Clonar docs legacy -> nuevo id gdt_<ULID>
for (const g of groups) {
  const nextId = mapping.get(g.id);
  if (!nextId) continue;
  const parent = g.data.parent_group_id;
  const parentNext = parent && mapping.has(parent) ? mapping.get(parent) : parent || null;
  const payload = {
    ...g.data,
    id: nextId,
    legacy_id: g.id,
    parent_group_id: parentNext,
    actualizado_en: FieldValue.serverTimestamp(),
  };
  ops.push({
    type: "set",
    ref: db.collection("grupos_de_trabajo").doc(nextId),
    data: payload,
    options: { merge: false },
  });
}

// 2) Actualizar parent_group_id en docs no migrados que apunten a legacy
for (const g of groups) {
  if (mapping.has(g.id)) continue;
  const parent = g.data.parent_group_id;
  if (!parent || !mapping.has(parent)) continue;
  ops.push({
    type: "update",
    ref: db.collection("grupos_de_trabajo").doc(g.id),
    data: {
      parent_group_id: mapping.get(parent),
      actualizado_en: FieldValue.serverTimestamp(),
    },
  });
  summary.updated_refs.grupos_parent_group_id += 1;
}

// 3) Actualizar referencias por colección
async function updateRefs(collectionName, field, counterKey) {
  for (const [oldId, newId] of mapping.entries()) {
    const snap = await db.collection(collectionName).where(field, "==", oldId).get();
    for (const doc of snap.docs) {
      ops.push({
        type: "update",
        ref: db.collection(collectionName).doc(doc.id),
        data: { [field]: newId, actualizado_en: FieldValue.serverTimestamp() },
      });
      summary.updated_refs[counterKey] += 1;
    }
  }
}

await updateRefs("historial_laboral_grupos", "grupo_de_trabajo_id", "historial_laboral_grupos");
await updateRefs("historial_laboral_cargos", "grupo_de_trabajo_id", "historial_laboral_cargos");
await updateRefs("personas", "grupo_de_trabajo_id", "personas");

// 4) Eliminar docs legacy
for (const oldId of mapping.keys()) {
  ops.push({ type: "delete", ref: db.collection("grupos_de_trabajo").doc(oldId) });
}

await commitOps(ops);

console.log(
  JSON.stringify(
    {
      ...summary,
      committed_ops: ops.length,
      message: "Migración aplicada con éxito.",
    },
    null,
    2,
  ),
);
