/**
 * Muestra capa_teorica materializada para un agente en fechas dadas.
 * Uso: node scripts/audit-fase0-capa-teorica-muestra.mjs
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildAsiDocumentId } = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));

const PERSONA_ID = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const FECHAS = ["2026-05-10", "2026-05-11", "2026-05-15", "2026-05-20"];

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

for (const fecha of FECHAS) {
  const docId = buildAsiDocumentId(PERSONA_ID, fecha);
  const snap = await db.collection("asistencia_diaria").doc(docId).get();
  console.log(`\n--- ${fecha} (${docId}) exists=${snap.exists} ---`);
  if (!snap.exists) continue;
  const capa = snap.data().capa_teorica;
  if (!capa) {
    console.log("sin capa_teorica");
    continue;
  }
  const segs = capa.segmentos || [];
  console.log(JSON.stringify({
    tipo_dia: capa.tipo_dia,
    turno_id: capa.turno_id,
    fichadas_esperadas: capa.fichadas_esperadas,
    segmentos_count: segs.length,
    primer_ingreso: segs[0]?.ingreso_iso,
    ultimo_egreso: segs[segs.length - 1]?.egreso_iso,
    origen: capa.origen,
    plan_id: capa.plan_id,
  }, null, 2));
}
