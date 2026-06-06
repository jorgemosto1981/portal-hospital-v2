/**
 * Fase 5 — Purga quirúrgica de vis_* legacy (sin bounded context gdt).
 *
 * Objetivo: eliminar documentos en `vistas_grilla_mes_agente` cuyo id NO contiene `_gdt_`.
 * Los documentos válidos tienen forma: vis_{YYYY}_{MM}_per_{ulid}_gdt_{ulid}
 *
 * Uso:
 *   node scripts/purge-vis-legacy.mjs              # dry-run (default)
 *   node scripts/purge-vis-legacy.mjs --dry-run
 *   node scripts/purge-vis-legacy.mjs --apply      # borra tras validación manual
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

const COL_VIS = "vistas_grilla_mes_agente";
const RX_VIS_PREFIX = /^vis_/i;
const MARKER_GDT = "_gdt_";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        const val = t.split("=")[1]?.trim() ?? "";
        return val.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  return {
    apply: flags.has("--apply"),
    dryRun: flags.has("--dry-run") || !flags.has("--apply"),
  };
}

/** @param {string} docId */
function esVisLegacy(docId) {
  const id = String(docId || "").trim();
  if (!RX_VIS_PREFIX.test(id)) return false;
  if (id.includes(MARKER_GDT)) return false;
  return true;
}

/** @param {string} docId */
function esVisScoped(docId) {
  return RX_VIS_PREFIX.test(docId) && String(docId).includes(MARKER_GDT);
}

async function listarVisLegacy(db) {
  const legacy = [];
  const scoped = [];
  const otros = [];
  let lastId = null;
  const pageSize = 500;

  while (true) {
    let q = db
      .collection(COL_VIS)
      .orderBy(FieldPath.documentId())
      .startAt("vis_")
      .endAt("vis_\uf8ff")
      .limit(pageSize);
    if (lastId) q = q.startAfter(lastId);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const id = doc.id;
      if (esVisLegacy(id)) {
        const data = doc.data() || {};
        legacy.push({
          vis_id: id,
          persona_id: data.persona_id || null,
          anio: data.anio ?? null,
          mes: data.mes ?? null,
          grupo_de_trabajo_id: data.grupo_de_trabajo_id || null,
          dias_keys: data.dias && typeof data.dias === "object" ? Object.keys(data.dias).length : 0,
        });
      } else if (esVisScoped(id)) {
        scoped.push(id);
      } else {
        otros.push(id);
      }
    }

    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < pageSize) break;
  }

  return { legacy, scopedCount: scoped.length, otros };
}

function validarListadoSeguro(legacy) {
  const contaminados = legacy.filter((row) => row.vis_id.includes(MARKER_GDT));
  if (contaminados.length > 0) {
    throw new Error(
      `ABORT: ${contaminados.length} documento(s) con _gdt_ en la lista legacy. Detener purga.`,
    );
  }
}

const args = parseArgs(process.argv);
const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

console.log("=== purge-vis-legacy.mjs ===");
console.log(`Modo: ${args.apply ? "APPLY (borrado real)" : "DRY-RUN (solo listado)"}`);
console.log(`Colección: ${COL_VIS}`);
console.log(`Criterio: id empieza con vis_ y NO contiene ${MARKER_GDT}\n`);

const { legacy, scopedCount, otros } = await listarVisLegacy(db);
validarListadoSeguro(legacy);

console.log(`Documentos vis_* scoped (_gdt_): ${scopedCount} (conservados)`);
if (otros.length > 0) {
  console.log(`[warn] ids vis_* atípicos (no legacy, no scoped): ${otros.length}`);
  for (const id of otros.slice(0, 10)) console.log(`  - ${id}`);
}

console.log(`\nDocumentos LEGACY a purgar: ${legacy.length}\n`);

if (legacy.length === 0) {
  console.log("Nada que purgar. Base limpia.");
  process.exit(0);
}

for (const row of legacy) {
  console.log(
    JSON.stringify({
      vis_id: row.vis_id,
      persona_id: row.persona_id,
      periodo: row.anio && row.mes ? `${row.anio}-${String(row.mes).padStart(2, "0")}` : null,
      grupo_embebido: row.grupo_de_trabajo_id,
      dias: row.dias_keys,
    }),
  );
}

if (args.dryRun) {
  console.log("\n[DRY-RUN] Sin borrados. Revisá el listado y ejecutá con --apply si es correcto.");
  process.exit(0);
}

console.log("\n[APPLY] Borrando documentos legacy…");
const batchSize = 400;
let borrados = 0;

for (let i = 0; i < legacy.length; i += batchSize) {
  const chunk = legacy.slice(i, i + batchSize);
  const batch = db.batch();
  for (const row of chunk) {
    if (row.vis_id.includes(MARKER_GDT)) {
      throw new Error(`ABORT en apply: id scoped detectado: ${row.vis_id}`);
    }
    batch.delete(db.collection(COL_VIS).doc(row.vis_id));
  }
  await batch.commit();
  borrados += chunk.length;
}

console.log(JSON.stringify({ ok: true, borrados, scoped_conservados: scopedCount }, null, 2));
