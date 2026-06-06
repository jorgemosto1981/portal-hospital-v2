/**
 * Borra físicamente documentos planes_turno_servicio por ID.
 * Uso: node scripts/borrar-planes-turno-por-id.mjs id1 id2 [--apply]
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const ids = argv.filter((a) => !a.startsWith("--"));

if (ids.length === 0) {
  console.error("Uso: node scripts/borrar-planes-turno-por-id.mjs <plan_id> [...] [--apply]");
  process.exit(1);
}

const gac = readFileSync(join(repoRoot, ".env.v2.local"), "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
const db = getFirestore();

for (const id of ids) {
  const ref = db.collection("planes_turno_servicio").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`[skip] ${id} — no existe`);
    continue;
  }
  const p = snap.data();
  console.log(`[found] ${id}`, {
    estado: p.estado,
    periodo: p.periodo,
    grupo_id: p.grupo_id,
    eliminado: p.eliminado,
  });
  if (!apply) {
    console.log(`  → dry-run (usar --apply para borrar)`);
    continue;
  }
  await ref.delete();
  console.log(`  → BORRADO`);
}

if (!apply) console.log("\nDry-run. Re-ejecutar con --apply para borrar físicamente.");
