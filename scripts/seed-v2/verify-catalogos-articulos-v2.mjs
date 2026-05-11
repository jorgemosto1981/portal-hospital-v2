/**
 * Verificación de existencia y conteo de documentos — catálogos Artículos V2.
 * Usa Admin SDK (no depende de reglas de cliente). Solo lectura.
 *
 * Uso (raíz del repo):
 *   node scripts/seed-v2/verify-catalogos-articulos-v2.mjs
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS y proyecto (FIREBASE_V2_PROJECT_ID o project_id en el JSON).
 */

import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const JSON_PATH = join(repoRoot, "docs", "v2", "SEED_CATALOGOS_ARTICULOS_V2.json");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    /* vacío */
  }
  return null;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o credenciales con project_id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const rawDbId = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
const db =
  rawDbId && rawDbId !== "default" && rawDbId !== "(default)"
    ? getFirestore(admin.app(), rawDbId)
    : getFirestore(admin.app());

function coleccionesDesdeJson() {
  const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const out = [];
  for (const [k, v] of Object.entries(raw)) {
    if (k === "_meta") continue;
    if (k === "cfg_tipo_evento_articulos") continue;
    if (Array.isArray(v)) out.push(k);
  }
  return out.sort();
}

async function main() {
  const cols = coleccionesDesdeJson();
  console.log(`[verify-articulos-v2] proyecto=${admin.app().options.projectId} colecciones=${cols.length}\n`);

  let vacias = 0;
  for (const name of cols) {
    try {
      const snap = await db.collection(name).get();
      const n = snap.size;
      if (n === 0) vacias += 1;
      const ok = n > 0 ? "OK" : "VACÍA";
      console.log(`${ok.padEnd(6)} ${String(n).padStart(3)}  ${name}`);
    } catch (e) {
      console.log(`ERROR  ---  ${name}  (${e?.code || ""} ${e?.message || e})`);
    }
  }

  console.log("\n[verify-articulos-v2] Resumen");
  console.log(`  Colecciones esperadas (JSON): ${cols.length}`);
  console.log(`  Colecciones sin documentos: ${vacias} (corré seed:catalogos-articulos-v2 si debían existir)`);
  if (vacias > 0) {
    console.log("  Código de salida 2 = advertencia (datos incompletos).");
    process.exit(2);
  }
  console.log("  Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
