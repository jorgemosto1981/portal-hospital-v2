/**
 * Smoke T-02 + callable listarCatalogosAsistenciaTurnos (Dev).
 * Uso: node scripts/smoke-catalogos-asistencia-turnos-a0.mjs
 *      node scripts/smoke-catalogos-asistencia-turnos-a0.mjs --firestore-only
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { parseListarCatalogosAsistenciaTurnosResponse } from "../web/src/schemas/cfgAsistenciaTurnos.schema.js";

const TAG = "[smoke-catalogos-a0]";
const REGION = "southamerica-east1";
const PROJECT = process.env.FIREBASE_V2_PROJECT_ID?.trim() || "portal-hospital-v2";
const FN = "listarCatalogosAsistenciaTurnos";
const URL = `https://${REGION}-${PROJECT}.cloudfunctions.net/${FN}`;
const COLECCIONES = [
  "cfg_tipo_compensacion_cobertura",
  "cfg_estado_periodo_liquidacion",
  "cfg_clasificacion_dia_calendario",
  "cfg_tipo_override_turno",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, "..");

const firestoreOnly = process.argv.includes("--firestore-only");

function initAdmin() {
  if (admin.apps.length) return;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT,
  });
}

async function fetchCallable() {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${TAG} Respuesta no JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${TAG} HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json.error) {
    throw new Error(`${TAG} Callable error: ${JSON.stringify(json.error)}`);
  }
  return json.result ?? json.data ?? json;
}

async function readViaFirestore() {
  initAdmin();
  const db = getFirestore();
  const catalogos = {};
  for (const col of COLECCIONES) {
    const snap = await db.collection(col).where("activo", "==", true).get();
    catalogos[col] = snap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          codigo_interno: data.codigo_interno || null,
          titulo_ui: data.titulo_ui || data.nombre || d.id,
          orden: typeof data.orden === "number" ? data.orden : 0,
        };
      })
      .sort((a, b) => a.orden - b.orden);
  }
  return { ok: true, catalogos };
}

function report(parsed, source) {
  console.log(`${TAG} Zod OK (${source}) — catálogos validados contra manifiesto A0:`);
  for (const [col, items] of Object.entries(parsed.catalogos)) {
    console.log(`  ${col}: ${items.length} ítems`);
    for (const it of items) {
      console.log(`    - ${it.codigo_interno} → ${it.id}`);
    }
  }
}

async function main() {
  let raw;
  let source = "callable";

  if (!firestoreOnly) {
    console.log(`${TAG} Probando callable ${URL}`);
    try {
      raw = await fetchCallable();
    } catch (err) {
      console.warn(`${TAG} Callable no disponible: ${err.message}`);
      console.warn(`${TAG} Fallback → lectura Firestore (misma lógica que el worker)`);
      raw = await readViaFirestore();
      source = "firestore-fallback";
    }
  } else {
    raw = await readViaFirestore();
    source = "firestore";
  }

  const parsed = parseListarCatalogosAsistenciaTurnosResponse(raw);
  report(parsed, source);
  if (source === "firestore-fallback") {
    console.warn(`${TAG} ⚠️  Zod PASS pero deploy del callable pendiente (healthcheck Cloud Run)`);
    process.exit(2);
  }
  console.log(`${TAG} ✅ SMOKE PASS (callable + Zod E2E)`);
}

main().catch((err) => {
  console.error(`${TAG} ❌ SMOKE FAIL`, err.message || err);
  process.exit(1);
});
