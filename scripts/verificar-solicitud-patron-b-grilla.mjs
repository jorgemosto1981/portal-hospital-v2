/**
 * Verifica evidencia de rechazo por grilla (Patrón B) en Firestore.
 *
 * Uso:
 *   node scripts/verificar-solicitud-patron-b-grilla.mjs sol_<ULID> [per_<ULID>]
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS (mismo .env.v2.local que otros scripts).
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

function saldoDocId(personaId, anio) {
  return `sal_${anio}_${personaId}`;
}

loadLocalEnvIfPresent();
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

const solId = (process.argv[2] || "").trim();
const personaArg = (process.argv[3] || "").trim();

if (!/^sol_[0-9A-HJKMNP-TV-Z]{26}$/i.test(solId)) {
  console.error("Argumento inválido. Usá: sol_<ULID>");
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

const solSnap = await db.collection("solicitudes_articulo").doc(solId).get();
if (!solSnap.exists) {
  console.error("No existe solicitudes_articulo/", solId);
  process.exit(1);
}

const s = solSnap.data() || {};
const personaId = personaArg || String(s.titular_persona_id || "").trim();
const anio = Number(s.anio_ciclo_consumo);
const artId = String(s.articulo_id || "").trim();
const bolsaKey = artId ? `bol_art_${artId.replace(/^art_/i, "")}_${anio}` : "";

const checks = {
  sol_id: solId,
  estado_solicitud_id: s.estado_solicitud_id,
  motor_codigos: s.motor_codigos,
  motor_mensajes: s.motor_mensajes,
  motor_descuento_aplicado: s.motor_descuento_aplicado,
  motor_dias_descontados: s.motor_dias_descontados,
  _debito_origen: s._debito_origen,
  fecha_desde: s.fecha_desde,
  titular_persona_id: s.titular_persona_id,
};

let ok = true;
if (s.estado_solicitud_id !== "cfg_esa_rechazada") {
  ok = false;
  checks.fail_estado = "Se esperaba cfg_esa_rechazada";
}
const codigos = Array.isArray(s.motor_codigos) ? s.motor_codigos.map(String) : [];
if (!codigos.includes("GRILLA_NO_AUTORIZADA")) {
  ok = false;
  checks.fail_codigo = "Se esperaba motor_codigos incluye GRILLA_NO_AUTORIZADA";
}
if (s.motor_descuento_aplicado === true) {
  ok = false;
  checks.fail_descuento = "motor_descuento_aplicado no debe ser true";
}
if (Array.isArray(s._debito_origen) && s._debito_origen.length > 0) {
  ok = false;
  checks.fail_debito = "_debito_origen debe estar vacío o ausente";
}

let saldoSlice = null;
if (/^per_/i.test(personaId) && Number.isFinite(anio)) {
  const salSnap = await db.collection("saldos_articulo_agente").doc(saldoDocId(personaId, anio)).get();
  if (salSnap.exists && bolsaKey) {
    const b = salSnap.data()?.bolsas?.[bolsaKey];
    saldoSlice = b
      ? { bolsa_id: bolsaKey, consumido: b.consumido, disponible: b.disponible }
      : { bolsa_id: bolsaKey, missing: true };
  }
}

console.log(JSON.stringify({ ok, checks, saldo_64a_ciclo: saldoSlice }, null, 2));
process.exit(ok ? 0 : 1);
