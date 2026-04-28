/**
 * Verifica completitud V2 de una persona por `persona_id`.
 *
 * Uso:
 *   node scripts/verificar-completitud-persona-v2.mjs per_<ULID>
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

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

loadLocalEnvIfPresent();
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

const personaId = (process.argv[2] || "").trim();
if (!/^per_[0-9A-HJKMNP-TV-Z]{26}$/.test(personaId)) {
  console.error("Argumento inválido. Usá: per_<ULID>");
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

const issues = [];

function addIssue(level, message, details = {}) {
  issues.push({ level, message, details });
}

function hasValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

const personaSnap = await db.collection("personas").doc(personaId).get();
if (!personaSnap.exists) {
  console.error(JSON.stringify({ ok: false, persona_id: personaId, error: "Persona no encontrada." }, null, 2));
  process.exit(1);
}

const persona = personaSnap.data() || {};

if (!hasValue(persona.dni)) addIssue("high", "Falta dni.");
if (!hasValue(persona.nombre)) addIssue("high", "Falta nombre.");
if (!hasValue(persona.apellido)) addIssue("high", "Falta apellido.");
if (!hasValue(persona.estado_perfil_datos_id)) addIssue("high", "Falta estado_perfil_datos_id.");

const contact = persona.contacto || {};
if (!hasValue(contact.telefono_celular)) addIssue("medium", "Falta contacto.telefono_celular.");

const domicilio = persona.domicilio || {};
for (const field of ["calle", "numero", "codigo_postal"]) {
  if (!hasValue(domicilio[field])) addIssue("medium", `Falta domicilio.${field}.`);
}

const formSnap = await db.collection("formacion_agente").where("persona_id", "==", personaId).get();
if (formSnap.empty) {
  addIssue("high", "No existe formacion_agente para la persona.");
} else if (formSnap.size > 1) {
  addIssue("medium", "Hay más de un formacion_agente (V2 sugiere 1 vigente).", { cantidad: formSnap.size });
}

const gfSnap = await db
  .collection("declaraciones_grupo_familiar")
  .where("titular_persona_id", "==", personaId)
  .get();
if (gfSnap.empty) {
  addIssue("high", "No existe declaraciones_grupo_familiar (gf_*) para la persona.");
}

const consSnap = await db.collection("consentimientos").where("persona_id", "==", personaId).get();
if (consSnap.empty) {
  addIssue("low", "No hay consentimientos cargados.");
}

const resumen = {
  persona_id: personaId,
  estado_perfil_datos_id: persona.estado_perfil_datos_id || null,
  counts: {
    formacion_agente: formSnap.size,
    declaraciones_grupo_familiar: gfSnap.size,
    consentimientos: consSnap.size,
  },
  issues,
  ok: issues.filter((x) => x.level === "high").length === 0,
};

console.log(JSON.stringify(resumen, null, 2));
