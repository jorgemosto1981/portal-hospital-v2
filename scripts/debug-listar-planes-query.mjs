import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
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

const grupoId = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const periodo = "2026-05";
const estado = "HABILITADO";

async function run(label, q) {
  const snap = await q.get();
  console.log(`\n${label}: ${snap.size}`);
  snap.docs.forEach((d) => {
    const p = d.data();
    console.log(`  ${d.id} estado=${p.estado} periodo=${p.periodo} eliminado=${p.eliminado}`);
  });
}

await run("solo grupo", db.collection("planes_turno_servicio").where("grupo_id", "==", grupoId));
await run("grupo+periodo", db.collection("planes_turno_servicio").where("grupo_id", "==", grupoId).where("periodo", "==", periodo));
await run("grupo+periodo+estado", db.collection("planes_turno_servicio").where("grupo_id", "==", grupoId).where("periodo", "==", periodo).where("estado", "==", estado));
