/**
 * Lista todas las filas de `usuarios_cuenta` con persona vinculada y estado de registro/login.
 *
 * Requiere en el entorno (p. ej. `.env.v2.local` cargado manualmente o variables exportadas):
 *   GOOGLE_APPLICATION_CREDENTIALS=ruta\al\serviceAccount.json
 *
 * Uso (desde la raíz del repo):
 *   node scripts/listar-usuarios-estado-acceso.mjs
 *   node scripts/listar-usuarios-estado-acceso.mjs --json
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const JSON_OUT = process.argv.includes("--json");

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

const ETIQUETA_ESTADO_ACCESO = {
  cfg_eca_pend_reg: "Pendiente registro (paso B)",
  cfg_eca_onb: "Onboarding datos",
  cfg_eca_activo: "Activo portal",
};

function ts(v) {
  if (!v) return "";
  if (typeof v.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof v === "object" && v._seconds != null) {
    return new Date(v._seconds * 1000).toISOString();
  }
  return String(v);
}

function registroResumido(cuenta, persona) {
  const authUid = cuenta.auth_uid != null && String(cuenta.auth_uid).trim() !== "";
  const username = cuenta.username != null && String(cuenta.username).trim() !== "";
  const pend = String(cuenta.estado_acceso || "") === "cfg_eca_pend_reg";
  if (!authUid && !username && pend) return "SIN_PASO_B (sin Auth)";
  if (authUid && username) return "PASO_B_OK (Auth + email en cuenta)";
  if (authUid && !username) return "PARCIAL (Auth sin username?)";
  if (!authUid && username) return "PARCIAL (email sin Auth?)";
  return "REVISAR";
}

function loginHabilitado(cuenta, persona) {
  if (cuenta.activo === false || (persona && persona.activo === false)) return "NO (cuenta/persona inactiva)";
  const ea = String(cuenta.estado_acceso || "");
  if (ea === "cfg_eca_pend_reg") return "NO (pendiente registro)";
  if (ea === "cfg_eca_onb") return "PARCIAL (onboarding)";
  if (ea === "cfg_eca_activo") return "SI (activo portal)";
  return ea ? `REVISAR (${ea})` : "SIN_ESTADO";
}

loadLocalEnvIfPresent();
// Evitar heredar FIRESTORE_EMULATOR_HOST / AUTH del shell (este script lista el proyecto real).
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath || !existsSync(credPath)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS apuntando a un JSON válido (.env.v2.local o export).");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(credPath, "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: process.env.FIREBASE_V2_PROJECT_ID?.trim() || sa.project_id,
  });
}

const db = admin.firestore();
const auth = admin.auth();

const [personasSnap, cuentasSnap] = await Promise.all([
  db.collection("personas").get(),
  db.collection("usuarios_cuenta").get(),
]);

const personaById = new Map(personasSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() || {}) }]));

const rows = [];
for (const doc of cuentasSnap.docs) {
  const cuenta = { id: doc.id, ...(doc.data() || {}) };
  const pid = String(cuenta.persona_id || "").trim();
  const persona = pid ? personaById.get(pid) || null : null;

  let authEmail = "";
  let authLastLogin = "";
  let authDisabled = "";
  let authError = "";
  const uid = typeof cuenta.auth_uid === "string" ? cuenta.auth_uid.trim() : "";
  if (uid) {
    try {
      const u = await auth.getUser(uid);
      authEmail = u.email || "";
      authLastLogin = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : "";
      authDisabled = u.disabled === true ? "si" : "no";
    } catch (e) {
      authError = (e && e.message) || "getUser falló";
    }
  }

  rows.push({
    cuenta_id: doc.id,
    persona_id: pid || "",
    dni: persona ? String(persona.dni || "") : "",
    nombre: persona ? String(persona.nombre || "") : "",
    apellido: persona ? String(persona.apellido || "") : "",
    persona_estado: persona ? String(persona.estado || "") : "(sin persona)",
    estado_perfil_datos_id: persona ? String(persona.estado_perfil_datos_id || "") : "",
    auth_vinculado: persona?.metadata?.auth_vinculado === true,
    estado_acceso: String(cuenta.estado_acceso || ""),
    estado_acceso_label: ETIQUETA_ESTADO_ACCESO[cuenta.estado_acceso] || cuenta.estado_acceso || "",
    cuenta_activa: cuenta.activo !== false,
    auth_uid: uid,
    username_cuenta: cuenta.username != null ? String(cuenta.username) : "",
    registro: registroResumido(cuenta, persona),
    login_portal: loginHabilitado(cuenta, persona),
    auth_email: authEmail,
    auth_ultimo_login: authLastLogin,
    auth_disabled: authDisabled,
    auth_error: authError,
    cuenta_creado: ts(cuenta.creado_en),
    cuenta_actualizado: ts(cuenta.actualizado_en),
  });
}

rows.sort((a, b) => (a.dni || "").localeCompare(b.dni || "") || a.persona_id.localeCompare(b.persona_id));

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const sep = " | ";
const header = [
  "cuenta_id",
  "persona_id",
  "dni",
  "apellido",
  "nombre",
  "estado_acceso",
  "registro",
  "login_portal",
  "auth_uid",
  "username",
  "auth_email",
  "ultimo_login_auth",
  "persona_estado",
  "vinc_firestore",
].join(sep);
console.log(header);
console.log("-".repeat(Math.min(header.length, 160)));
for (const r of rows) {
  console.log(
    [
      r.cuenta_id,
      r.persona_id,
      r.dni,
      r.apellido,
      r.nombre,
      r.estado_acceso,
      r.registro,
      r.login_portal,
      r.auth_uid || "—",
      r.username_cuenta || "—",
      r.auth_email || "—",
      r.auth_ultimo_login || "—",
      r.persona_estado,
      r.auth_vinculado ? "si" : "no",
    ].join(sep),
  );
}

const byEstado = rows.reduce((acc, r) => {
  const k = r.estado_acceso || "(vacío)";
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log("\nResumen por estado_acceso:", byEstado);
console.log(`Total usuarios_cuenta: ${rows.length} · Total personas: ${personasSnap.size}`);

const sinPersona = rows.filter((r) => !r.persona_id || r.persona_estado === "(sin persona)");
if (sinPersona.length) {
  console.log(`\nAtención: ${sinPersona.length} cuenta(s) sin persona resoluble en Firestore.`);
}

const pidsConCuenta = new Set(rows.map((r) => r.persona_id).filter(Boolean));
const personasSinCuenta = personasSnap.docs.filter((d) => !pidsConCuenta.has(d.id));
if (personasSinCuenta.length) {
  console.log(
    `\nPersonas sin usuarios_cuenta (${personasSinCuenta.length}):`,
    personasSinCuenta.map((d) => `${d.id} dni=${(d.data() || {}).dni || ""}`).join(" · "),
  );
}
