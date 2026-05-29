/**
 * Fase 5b — Elimina el campo raíz `capa_teorica` (legacy) de asistencia_diaria.
 * Preserva capa_teorica_por_grupo, aportes_normativos, overrides_turno.
 *
 * Uso:
 *   node scripts/strip-capa-teorica-legacy.mjs              # dry-run (default)
 *   node scripts/strip-capa-teorica-legacy.mjs --dry-run
 *   node scripts/strip-capa-teorica-legacy.mjs --apply
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore } from "firebase-admin/firestore";

const COL_ASI = "asistencia_diaria";
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

function tieneCapaLegacy(data) {
  if (!data || typeof data !== "object") return false;
  return Object.prototype.hasOwnProperty.call(data, "capa_teorica");
}

function contarGrupos(data) {
  const map = data?.capa_teorica_por_grupo;
  if (!map || typeof map !== "object") return 0;
  return Object.keys(map).length;
}

const args = parseArgs(process.argv);
const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

console.log("=== strip-capa-teorica-legacy.mjs ===");
console.log(`Modo: ${args.apply ? "APPLY (borrado campo)" : "DRY-RUN (solo listado)"}`);
console.log(`Colección: ${COL_ASI}`);
console.log("Acción: FieldValue.delete() en campo raíz `capa_teorica`\n");

const candidatos = [];
let scanned = 0;
let lastId = null;
const pageSize = 500;

while (true) {
  let q = db
    .collection(COL_ASI)
    .orderBy(FieldPath.documentId())
    .startAt("asi_")
    .endAt("asi_\uf8ff")
    .limit(pageSize);
  if (lastId) q = q.startAfter(lastId);

  const snap = await q.get();
  if (snap.empty) break;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data();
    if (!tieneCapaLegacy(data)) continue;
    candidatos.push({
      asi_id: doc.id,
      persona_id: data.persona_id || null,
      fecha: data.fecha || null,
      grupos_en_mapa: contarGrupos(data),
      origen_legacy: data.capa_teorica?.origen || data.capa_teorica?.tipo_dia || null,
    });
  }

  lastId = snap.docs[snap.docs.length - 1].id;
  if (snap.size < pageSize) break;
}

console.log(`Documentos asi_* escaneados: ${scanned}`);
console.log(`Con campo capa_teorica legacy: ${candidatos.length}\n`);

if (candidatos.length === 0) {
  console.log("Nada que limpiar. Esquema ya sin capa_teorica raíz.");
  process.exit(0);
}

for (const row of candidatos) {
  console.log(JSON.stringify(row));
}

if (args.dryRun) {
  console.log("\n[DRY-RUN] Sin cambios. Ejecutá con --apply tras validar el listado.");
  process.exit(0);
}

console.log("\n[APPLY] Eliminando campo capa_teorica…");
const batchSize = 400;
let stripped = 0;

for (let i = 0; i < candidatos.length; i += batchSize) {
  const chunk = candidatos.slice(i, i + batchSize);
  const batch = db.batch();
  for (const row of chunk) {
    batch.update(db.collection(COL_ASI).doc(row.asi_id), {
      capa_teorica: FieldValue.delete(),
    });
  }
  await batch.commit();
  stripped += chunk.length;
}

console.log(JSON.stringify({ ok: true, stripped, scanned }, null, 2));
