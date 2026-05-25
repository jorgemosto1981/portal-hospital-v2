/**
 * Comprobaciones previas al código (V2): repo, env cliente, Firestore, CLI, seed.
 *
 * Uso (desde la raíz portal-hospital-v2/):
 *   npm run verify:pre-coding
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const results = { ok: [], warn: [], fail: [], manual: [] };

function ok(msg) {
  results.ok.push(msg);
  console.log(`[OK]   ${msg}`);
}
function warn(msg) {
  results.warn.push(msg);
  console.log(`[WARN] ${msg}`);
}
function fail(msg) {
  results.fail.push(msg);
  console.log(`[FAIL] ${msg}`);
}
function manual(msg) {
  results.manual.push(msg);
  console.log(`[MANUAL] ${msg}`);
}

function loadDotEnvLocal(path) {
  const out = {};
  if (!existsSync(path)) return out;
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

function mustExist(rel, label) {
  const p = join(repoRoot, ...rel.split("/"));
  if (existsSync(p)) ok(`${label}: ${rel}`);
  else fail(`Falta archivo: ${rel}`);
}

console.log("\n=== Portal Hospital V2 — verificación previa al código ===\n");

console.log("--- 1) Estructura del repo ---\n");
mustExist("firebase.json", "Config Firebase (raíz; functions + rutas a firebase-v2/)");
mustExist("firebase-v2/firestore.rules", "Reglas Firestore");
mustExist("firebase-v2/firestore.indexes.json", "Índices Firestore");
mustExist("src/firebaseConfig.v2.js", "Cliente web V2");
mustExist(".firebaserc", "Proyecto default CLI");
mustExist("package.json", "package.json");

console.log("\n--- 2) Variables web (.env.v2.local) ---\n");
const envPath = join(repoRoot, ".env.v2.local");
const requiredEnv = [
  "VITE_V2_FIREBASE_API_KEY",
  "VITE_V2_FIREBASE_AUTH_DOMAIN",
  "VITE_V2_FIREBASE_PROJECT_ID",
  "VITE_V2_FIREBASE_STORAGE_BUCKET",
  "VITE_V2_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_V2_FIREBASE_APP_ID",
];

if (!existsSync(envPath)) {
  fail("No existe .env.v2.local (copiá desde .env.v2.example y completá valores de la consola).");
} else {
  ok(".env.v2.local presente");
  const env = loadDotEnvLocal(envPath);
  for (const k of requiredEnv) {
    if (!env[k]) fail(`Falta variable ${k} en .env.v2.local`);
  }
  if (env.VITE_V2_FIREBASE_PROJECT_ID && env.VITE_V2_FIREBASE_PROJECT_ID !== "portal-hospital-v2") {
    warn(
      `VITE_V2_FIREBASE_PROJECT_ID="${env.VITE_V2_FIREBASE_PROJECT_ID}" distinto de portal-hospital-v2 — confirmá que sea intencional.`,
    );
  }
  const placeholders = ["your-api-key", "your-sender-id", "your-app-id", "G-XXXXXXXXXX"];
  for (const k of requiredEnv) {
    const v = env[k] || "";
    if (placeholders.some((p) => v.includes(p) || v === p)) {
      fail(`Variable ${k} parece placeholder; reemplazá con el valor de la consola Firebase.`);
    }
  }
}

console.log("\n--- 3) Conexión Firestore (SDK cliente) ---\n");
try {
  execSync("npm run test:firestore:v2", {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });
  ok("npm run test:firestore:v2 terminó sin error");
} catch (e) {
  const out = (e.stdout || "") + (e.stderr || "");
  fail("npm run test:firestore:v2 falló. Salida:");
  console.log(out.slice(0, 4000));
}

console.log("\n--- 4) CLI Firebase (sesión) ---\n");
try {
  execSync("npm run firebase -- projects:list", {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
    timeout: 45_000,
  });
  ok("firebase projects:list OK (sesión válida)");
} catch (e) {
  const err = `${e.stderr || ""}${e.stdout || ""}`;
  if (/401|authentication|login/i.test(err)) {
    warn("CLI: sesión inválida o caducada. Ejecutá: npm run firebase -- login");
  } else {
    warn(`CLI projects:list no OK: ${err.slice(0, 500)}`);
  }
}

console.log("\n--- 5) Seed Firestore (política del proyecto) ---\n");
ok(
  "No se ejecuta ningún script de semilla en esta verificación. Los volcados `seed:*` están bloqueados salvo ALLOW_FIRESTORE_SEED_V2=true (mantenimiento explícito). Catálogos: datos reales / consola / proceso operativo acordado.",
);

console.log("\n--- 6) Comprobaciones solo en consola Firebase / GCP ---\n");
manual("Authentication → método «Correo/contraseña» activado en proyecto portal-hospital-v2.");
manual("Tras cambiar reglas en el repo: npm run firebase:deploy:firestore y verificar en consola que las reglas son las de V2.");
manual("Front Vite: app en `web/` (`npm run dev:web`) o integrar en ../portal-hospital-v1/portal-hospital (README + docs/v2/ARRANQUE_BD_Y_CODIGO_V2.md).");
manual("Leer docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md e INFORME_MAESTRO_DESARROLLO_LOGIN_DATOS_V2.md §1–3 antes del primer PR de código.");

console.log("\n=== Resumen ===\n");
console.log(`OK: ${results.ok.length} · WARN: ${results.warn.length} · FAIL: ${results.fail.length} · MANUAL: ${results.manual.length}`);
if (results.fail.length) {
  console.log("\nHay FAIL: corregí lo anterior antes de asumir entorno listo para codificar.\n");
  process.exit(1);
}
if (results.warn.length) {
  console.log("\nHay WARN/MANUAL: podés codificar con matices; cerrá los WARN cuando puedas.\n");
  process.exit(0);
}
console.log("\nSin FAIL. Revisá ítems MANUAL y seguí el orden de fases en la documentación.\n");
process.exit(0);
