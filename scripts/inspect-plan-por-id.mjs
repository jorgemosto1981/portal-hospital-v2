import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const id = process.argv[2];
if (!id) {
  console.error("Uso: node scripts/inspect-plan-por-id.mjs <plan_id>");
  process.exit(1);
}
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
const snap = await getFirestore().collection("planes_turno_servicio").doc(id).get();
if (!snap.exists) {
  console.log("NO_EXISTE", id);
  process.exit(1);
}
const p = snap.data();
console.log(JSON.stringify({
  id: snap.id,
  estado: p.estado,
  tipo_plan: p.tipo_plan,
  periodo: p.periodo,
  grupo_id: p.grupo_id,
  eliminado: p.eliminado,
  materializacion_fallida: p.materializacion_fallida,
  agentes: (p.agentes || []).length,
}, null, 2));
