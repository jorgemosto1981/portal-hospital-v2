/**
 * Limpieza segura de usuarios test en Firestore V2.
 *
 * Uso:
 *   node scripts/cleanup-usuarios-test.mjs            // dry-run
 *   node scripts/cleanup-usuarios-test.mjs --apply    // aplica borrado
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TOKENS_TEST = ["test", "prueba", "demo", "qa", "fake", "tmp", "zzz"];
const PROTECTED_DNI = new Set(["1234567"]);
const APPLY = process.argv.includes("--apply");

function loadLocalEnvIfPresent() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = join(here, "..", ".env.v2.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveProjectId(credPath) {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    // noop
  }
  return null;
}

function norm(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}

function hasTestToken(...values) {
  const blob = values.map(norm).join(" ");
  return TOKENS_TEST.some((t) => blob.includes(t));
}

loadLocalEnvIfPresent();
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

if (!admin.apps.length) {
  const projectId = resolveProjectId(credPath);
  if (!projectId) {
    console.error("No se pudo resolver FIREBASE project id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(getApp());

const [personasSnap, cuentasSnap] = await Promise.all([
  db.collection("personas").get(),
  db.collection("usuarios_cuenta").get(),
]);

const personaById = new Map(personasSnap.docs.map((d) => [d.id, d.data() || {}]));
const cuentasByPersonaId = new Map();
for (const c of cuentasSnap.docs) {
  const pid = String((c.data() || {}).persona_id || "").trim();
  if (!pid) continue;
  if (!cuentasByPersonaId.has(pid)) cuentasByPersonaId.set(pid, []);
  cuentasByPersonaId.get(pid).push(c);
}

const candidatos = [];
for (const pDoc of personasSnap.docs) {
  const p = pDoc.data() || {};
  const pid = pDoc.id;
  const dni = String(p.dni || "").trim();
  if (PROTECTED_DNI.has(dni)) continue;
  const cuentas = cuentasByPersonaId.get(pid) || [];
  const cuenta = cuentas[0] ? cuentas[0].data() || {} : {};
  const esTest = hasTestToken(
    pid,
    p.nombre,
    p.apellido,
    p.dni,
    cuenta.username,
    cuenta.auth_uid,
  );
  if (!esTest) continue;
  candidatos.push({
    personaDoc: pDoc,
    cuentaDocs: cuentas,
    resumen: {
      persona_id: pid,
      dni,
      nombre: String(p.nombre || ""),
      apellido: String(p.apellido || ""),
      username: String(cuenta.username || ""),
    },
  });
}

console.log(
  JSON.stringify(
    {
      apply: APPLY,
      candidatos: candidatos.map((c) => c.resumen),
      total_candidatos: candidatos.length,
    },
    null,
    2,
  ),
);

if (!APPLY || candidatos.length === 0) process.exit(0);

let totalPersonas = 0;
let totalCuentas = 0;
for (const c of candidatos) {
  const batch = db.batch();
  batch.delete(c.personaDoc.ref);
  totalPersonas += 1;
  for (const q of c.cuentaDocs) {
    batch.delete(q.ref);
    totalCuentas += 1;
  }
  await batch.commit();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      borradas_personas: totalPersonas,
      borradas_cuentas: totalCuentas,
    },
    null,
    2,
  ),
);
