/**
 * Restaura (undelete) un plan mensual marcado eliminado: true.
 * Uso: node scripts/restaurar-plan-turno-eliminado.mjs --plan-id=plt_xxx [--apply]
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const planArg = args.find((a) => a.startsWith("--plan-id="));
const planId = planArg ? planArg.split("=")[1] : "plt_01KSMNGHNTJAYC19Z11Q5ZVT5M";

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

const ref = db.collection("planes_turno_servicio").doc(planId);
const snap = await ref.get();
if (!snap.exists) {
  console.error("Plan no existe:", planId);
  process.exit(1);
}
const p = snap.data();
console.log("Antes:", {
  id: planId,
  estado: p.estado,
  eliminado: p.eliminado,
  eliminado_en: p.eliminado_en,
  motivo_eliminacion: p.motivo_eliminacion,
});

if (p.eliminado !== true) {
  console.log("El plan no está marcado como eliminado. Nada que hacer.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry-run. Para restaurar: node scripts/restaurar-plan-turno-eliminado.mjs --plan-id=" + planId + " --apply");
  process.exit(0);
}

await ref.update({
  eliminado: FieldValue.delete(),
  eliminado_en: FieldValue.delete(),
  motivo_eliminacion: FieldValue.delete(),
  eliminado_por_uid: FieldValue.delete(),
  actualizado_en: FieldValue.serverTimestamp(),
});
console.log("\nRestaurado:", planId);
