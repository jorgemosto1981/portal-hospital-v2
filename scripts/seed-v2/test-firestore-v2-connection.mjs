/**
 * Prueba de conectividad Firestore V2 (SDK cliente + credenciales web en .env.v2.local).
 * Siempre contra el proyecto en la nube. Con reglas deny-all, una lectura puede fallar con permission-denied.
 *
 * Uso (desde la raíz portal-hospital-v2/):
 *   npm run test:firestore:v2
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const envPath = join(repoRoot, ".env.v2.local");

function loadDotEnvLocal(path) {
  const out = {};
  if (!existsSync(path)) {
    return out;
  }
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadDotEnvLocal(envPath);

const required = [
  "VITE_V2_FIREBASE_API_KEY",
  "VITE_V2_FIREBASE_AUTH_DOMAIN",
  "VITE_V2_FIREBASE_PROJECT_ID",
  "VITE_V2_FIREBASE_STORAGE_BUCKET",
  "VITE_V2_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_V2_FIREBASE_APP_ID",
];

const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(
    `[test-firestore-v2] Falta ${envPath} o variables: ${missing.join(", ")}. Copiá desde .env.v2.example y completá los valores de la consola Firebase.`,
  );
  process.exit(1);
}

const firebaseConfig = {
  apiKey: env.VITE_V2_FIREBASE_API_KEY,
  authDomain: env.VITE_V2_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_V2_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_V2_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_V2_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_V2_FIREBASE_APP_ID,
  measurementId: env.VITE_V2_FIREBASE_MEASUREMENT_ID || undefined,
};

const appName = "portal-hospital-v2-test-cli";
const app = initializeApp(firebaseConfig, appName);
const db = getFirestore(app);

const probeRef = doc(db, "_connectivity_probe", "ping");

/** El SDK a veces envuelve gRPC NOT_FOUND como fallo de «offline»; recorremos causa + stack. */
function errorChainIncludesNotFound(err) {
  const seen = new Set();
  let cur = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const blob = [cur.code, cur.message, cur.reason, cur.stack, String(cur)]
      .filter(Boolean)
      .join(" ");
    if (/\bnot-found\b|\bNOT_FOUND\b|\b5 NOT_FOUND\b/i.test(blob)) return true;
    cur = cur.cause;
  }
  return false;
}

try {
  await getDoc(probeRef);
  console.log(
    "[test-firestore-v2] OK: lectura permitida (revisá reglas; en deny-all no debería ocurrir).",
  );
  process.exit(0);
} catch (e) {
  const code = e?.code;
  const msg = e?.message || String(e);
  if (code === "permission-denied") {
    console.log(
      "[test-firestore-v2] OK: Firestore respondió (permission-denied = reglas cerradas, conexión y proyecto activos).",
    );
    console.log(`  Proyecto: ${firebaseConfig.projectId}`);
    process.exit(0);
  }

  if (errorChainIncludesNotFound(e)) {
    console.error(
      "[test-firestore-v2] NOT_FOUND: no hay base Firestore (modo Native) en este proyecto, o el databaseId no coincide.",
    );
    console.error(`  Proyecto: ${firebaseConfig.projectId}`);
    console.error(
      "  Siguiente paso: crear la base (consola Firebase / GCP o `npm run firestore:create` con gcloud). Ver docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md § «Conectar la base de datos».",
    );
    console.error("  Detalle:", msg);
    process.exit(1);
  }

  if (code === "unavailable" || /offline|network/i.test(msg)) {
    console.error("[test-firestore-v2] El SDK reportó indisponible / offline:", msg);
    console.error(
      "  Si en la consola del SDK aparece «5 NOT_FOUND» antes de este mensaje, en proyectos nuevos suele faltar **crear la base Firestore (Native)** en GCP.",
    );
    process.exit(1);
  }

  console.error("[test-firestore-v2] Error inesperado:", code || "", msg);
  process.exit(1);
}
