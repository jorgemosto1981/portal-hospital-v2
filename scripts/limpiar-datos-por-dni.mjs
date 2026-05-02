/**
 * Borra de Firestore (y Auth) los datos vinculados a un DNI concreto: persona, cuenta,
 * historiales laborales, eventos, formación, DDJJ familiar, consentimientos.
 *
 * Uso (raíz del repo, credencial en .env.v2.local → GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/limpiar-datos-por-dni.mjs 1234567              # solo plan (dry-run)
 *   node scripts/limpiar-datos-por-dni.mjs 1234567 --apply      # ejecuta borrados
 *
 * Requiere coincidir exactamente un documento en `personas` con ese DNI (solo dígitos).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

function normalizeDni(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

function loadLocalEnvIfPresent() {
  const envPath = join(repoRoot, ".env.v2.local");
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
    /* ignore */
  }
  return null;
}

/** @param {FirebaseFirestore.Firestore} db */
async function collectWhere(db, collection, field, value) {
  if (!value && value !== 0) return [];
  const snap = await db.collection(collection).where(field, "==", value).get();
  return snap.docs.map((d) => ({ ref: d.ref, id: d.id }));
}

/** @param {FirebaseFirestore.Firestore} db @param {string} cuentaId */
async function eventosPorCuenta(db, cuentaId) {
  if (!cuentaId) return [];
  const snap = await db.collection("eventos_ticket").where("cuenta_id", "==", cuentaId).get();
  return snap.docs.map((d) => ({ ref: d.ref, id: d.id }));
}

/** @param {FirebaseFirestore.WriteBatch} batch @param {FirebaseFirestore.DocumentReference[]} refs */
function batchDeletes(batch, refs) {
  for (const r of refs) {
    batch.delete(r);
  }
}

const argvPos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dni = normalizeDni(argvPos[0] || "");
if (!/^\d{6,12}$/.test(dni)) {
  console.error("Uso: node scripts/limpiar-datos-por-dni.mjs <DNI_6_a_12_digitos> [--apply]");
  process.exit(1);
}

loadLocalEnvIfPresent();
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath || !existsSync(credPath)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS válido.");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(readFileSync(credPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: resolveProjectId(credPath) || sa.project_id,
  });
}

const db = admin.firestore();
const auth = admin.auth();

const ps = await db.collection("personas").where("dni", "==", dni).limit(5).get();
if (ps.empty) {
  console.log(JSON.stringify({ ok: false, mensaje: "No hay persona con ese DNI.", dni }, null, 2));
  process.exit(0);
}
if (ps.size > 1) {
  console.error(JSON.stringify({ ok: false, error: "Más de una persona con el mismo DNI. Corregí manualmente.", dni, ids: ps.docs.map((d) => d.id) }, null, 2));
  process.exit(1);
}

const personaRef = ps.docs[0].ref;
const personaId = personaRef.id;
const persona = ps.docs[0].data() || {};

const cuSnap = await db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(5).get();
const cuentaRefs = cuSnap.docs.map((d) => ({ ref: d.ref, id: d.id, data: d.data() || {} }));
const cuentaIds = cuentaRefs.map((c) => c.id);
const authUids = [
  ...new Set(
    cuentaRefs.map((c) => String(c.data.auth_uid || "").trim()).filter(Boolean),
  ),
];

const plan = {
  apply: APPLY,
  dni,
  persona_id: personaId,
  persona_resumen: {
    nombre: persona.nombre,
    apellido: persona.apellido,
    estado: persona.estado,
  },
  cuentas: cuentaIds,
  auth_uids: authUids,
  borrar: /** @type {Record<string, string[]>} */ ({}),
};

const seenPaths = new Set();
const todosRefs = [];

/** @param {FirebaseFirestore.DocumentReference} ref */
function addRef(ref) {
  const p = ref.path;
  if (seenPaths.has(p)) return;
  seenPaths.add(p);
  todosRefs.push(ref);
}

const pushCol = async (label, dbFn) => {
  const refs = await dbFn();
  plan.borrar[label] = refs.map((r) => r.id);
  for (const r of refs) {
    addRef(r.ref);
  }
};

await pushCol("historial_laboral_grupos", () => collectWhere(db, "historial_laboral_grupos", "persona_id", personaId));
await pushCol("historial_laboral_datos", () => collectWhere(db, "historial_laboral_datos", "persona_id", personaId));
await pushCol("historial_laboral_cargos", () => collectWhere(db, "historial_laboral_cargos", "persona_id", personaId));
await pushCol("formacion_agente", () => collectWhere(db, "formacion_agente", "persona_id", personaId));
await pushCol("declaraciones_grupo_familiar", () =>
  collectWhere(db, "declaraciones_grupo_familiar", "titular_persona_id", personaId),
);
await pushCol("consentimientos", () => collectWhere(db, "consentimientos", "persona_id", personaId));
await pushCol("eventos_ticket_persona", () => collectWhere(db, "eventos_ticket", "persona_id", personaId));

for (const cid of cuentaIds) {
  const ev = await eventosPorCuenta(db, cid);
  plan.borrar[`eventos_ticket_cuenta_${cid}`] = ev.map((e) => e.id);
  for (const e of ev) {
    addRef(e.ref);
  }
}

plan.borrar.usuarios_cuenta = cuentaIds;
plan.borrar.personas = [personaId];

console.log(JSON.stringify(plan, null, 2));
console.log(`\nTotal referencias a borrar (aprox.): ${todosRefs.length + cuentaRefs.length + 1}`);

if (!APPLY) {
  console.log("\n[DRY-RUN] No se borró nada. Ejecutá de nuevo con --apply para confirmar.");
  process.exit(0);
}

const CHUNK = 400;
for (let i = 0; i < todosRefs.length; i += CHUNK) {
  const batch = db.batch();
  batchDeletes(batch, todosRefs.slice(i, i + CHUNK));
  await batch.commit();
}

{
  const batch = db.batch();
  for (const { ref } of cuentaRefs) {
    batch.delete(ref);
  }
  await batch.commit();
}

await personaRef.delete();

for (const uid of authUids) {
  try {
    await auth.deleteUser(uid);
    console.log(`[Auth] Usuario borrado: ${uid}`);
  } catch (e) {
    console.warn(`[Auth] No se pudo borrar uid=${uid}:`, e.message || e);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      dni,
      persona_id: personaId,
      borrado_firestore: true,
      auth_borrados: authUids.length,
    },
    null,
    2,
  ),
);
