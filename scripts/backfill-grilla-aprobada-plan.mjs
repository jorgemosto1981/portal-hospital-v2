/**
 * Persiste grilla_aprobada en un plan HABILITADO (backfill / piloto).
 * Uso: node scripts/backfill-grilla-aprobada-plan.mjs plt_01KSR8J55H1TN10M3ANSSWMPF2
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const planId = process.argv[2];
if (!planId) {
  console.error("Uso: node scripts/backfill-grilla-aprobada-plan.mjs <plan_id>");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const gacLine = readFileSync(join(repoRoot, ".env.v2.local"), "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="));
const gac = gacLine?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "portal-hospital-v2";

const require = createRequire(import.meta.url);
const { construirGrillaAprobada } = require("../functions/modules/asistencia/planGrillaAprobadaBuilder.js");

const db = getFirestore();
const ref = db.collection("planes_turno_servicio").doc(planId);
const snap = await ref.get();
if (!snap.exists) {
  console.error("Plan no encontrado:", planId);
  process.exit(1);
}
const data = snap.data();
if (data.estado !== "HABILITADO") {
  console.error("El plan debe estar HABILITADO. Estado actual:", data.estado);
  process.exit(1);
}
if (data.tipo_plan !== "mensual") {
  console.error("Solo aplica a planes mensuales.");
  process.exit(1);
}

const grilla = await construirGrillaAprobada({ plan: data, planId });
if (!grilla?.agentes?.length) {
  console.error("No se pudo construir grilla_aprobada.");
  process.exit(1);
}

await ref.update({
  grilla_aprobada: grilla,
  grilla_aprobada_en: FieldValue.serverTimestamp(),
});

console.log(JSON.stringify({
  ok: true,
  plan_id: planId,
  agentes: grilla.agentes.length,
  dias_muestra: Object.keys(grilla.agentes[0]?.dias || {}).length,
}, null, 2));
