/**
 * Bootstrap mínimo portal-hospital-v2-dev:
 * GDT "grupo base inicial" + Auth/login DNI + cadena HLc→HLd→HLg (CFG_USUARIO) + allowlist Etapa 1.
 *
 * Uso (PowerShell, siempre apuntando a-dev):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\...\adminsdk-dev.json"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/bootstrap-dev-agente.mjs
 *
 * Opcional: DEMO_LOGIN_DNI DEMO_LOGIN_PIN DEMO_LOGIN_EMAIL DEMO_NOMBRE DEMO_APELLIDO
 */
import "../load-env-v2.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import { getAdminDb, resolveProjectId } from "../lib/firestoreAdminBootstrap.mjs";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
} from "../../shared/utils/etapa1RuntimeConfig.js";

assertFirestoreSeedAllowed("bootstrap-dev-agente");

const require = createRequire(import.meta.url);
const { ulid } = require(join(dirname(fileURLToPath(import.meta.url)), "../../web/node_modules/ulid"));

const { computeLaborProfileForPersona } = require("../../functions/modules/shared/laborProfile.js");
const { applyLaborAwareSessionClaims } = require("../../functions/modules/shared/authClaims.js");

const projectId = resolveProjectId();
if (projectId !== "portal-hospital-v2-dev") {
  console.error(`[bootstrap-dev] Abort: project=${projectId} (esperado portal-hospital-v2-dev)`);
  process.exit(1);
}

const db = getAdminDb();
const auth = getAuth();

function normalizeDni(s) {
  return String(s || "").replace(/\D/g, "");
}

const dni = normalizeDni(process.env.DEMO_LOGIN_DNI || "28914247");
const pin = normalizeDni(process.env.DEMO_LOGIN_PIN || "123456");
const email =
  (process.env.DEMO_LOGIN_EMAIL || "").trim().toLowerCase() ||
  `portal-dev-${dni}@example.com`;
const nombre = String(process.env.DEMO_NOMBRE || "Jorge").trim() || "Jorge";
const apellido = String(process.env.DEMO_APELLIDO || "Mosto").trim() || "Mosto";

if (!/^\d{6,12}$/.test(dni) || !/^\d{6}$/.test(pin)) {
  console.error("[bootstrap-dev] DNI 6–12 dígitos y PIN 6 dígitos.");
  process.exit(1);
}

const gdtId = `gdt_${ulid()}`;
const perId = `per_${ulid()}`;
const usrId = `usr_${ulid()}`;
const hlcId = `hlc_${ulid()}`;
const hldId = `hld_${ulid()}`;
const hlgId = `hlg_${ulid()}`;
const ts = FieldValue.serverTimestamp();

console.log(`[bootstrap-dev] project=${projectId}`);
console.log(`[bootstrap-dev] GDT ${gdtId} «grupo base inicial»`);
console.log(`[bootstrap-dev] persona ${perId} DNI ${dni}`);

await db.collection("grupos_de_trabajo").doc(gdtId).set({
  id: gdtId,
  nombre: "grupo base inicial",
  activo: true,
  nivel_arbol: 1,
  vigente_desde: "2020-01-01",
  vigente_hasta: null,
  schema_version: 1,
  creado_en: ts,
  actualizado_en: ts,
  metadata: { seed_bootstrap_dev: true },
});

let uid;
try {
  const existing = await auth.getUserByEmail(email);
  uid = existing.uid;
  await auth.updateUser(uid, { password: pin });
  console.log(`[bootstrap-dev] Auth existente ${email}, PIN actualizado`);
} catch (e) {
  if (e?.code !== "auth/user-not-found") throw e;
  const rec = await auth.createUser({ email, password: pin, emailVerified: false });
  uid = rec.uid;
  console.log(`[bootstrap-dev] Auth creado ${email} uid=${uid}`);
}

await db.collection("personas").doc(perId).set({
  persona_id: perId,
  dni,
  nombre,
  apellido,
  estado: "ACTIVO",
  activo: true,
  schema_version: 1,
  estado_perfil_datos_id: "cfg_epd_borr",
  perfil_completitud_version: 0,
  metadata: { seed_bootstrap_dev: true },
  creado_en: ts,
  actualizado_en: ts,
});

await db.collection("usuarios_cuenta").doc(usrId).set({
  persona_id: perId,
  auth_uid: uid,
  auth_proveedor_id: "password",
  username: email,
  activo: true,
  estado_acceso: "cfg_eca_activo",
  role_ids: ["CFG_USUARIO"],
  creado_en: ts,
  actualizado_en: ts,
});

await db.collection("historial_laboral_cargos").doc(hlcId).set({
  persona_id: perId,
  rol_id: "CFG_USUARIO",
  activo: true,
  fecha_desde: "2020-01-01",
  fecha_hasta: null,
  grupo_de_trabajo_id: gdtId,
  schema_version: 1,
  creado_en: ts,
  actualizado_en: ts,
});

await db.collection("historial_laboral_datos").doc(hldId).set({
  persona_id: perId,
  cargo_id: hlcId,
  activo: true,
  fecha_inicio: "2020-01-01",
  fecha_fin: null,
  schema_version: 1,
  creado_en: ts,
  actualizado_en: ts,
});

await db.collection("historial_laboral_grupos").doc(hlgId).set({
  persona_id: perId,
  dato_laboral_id: hldId,
  grupo_de_trabajo_id: gdtId,
  nivel_jerarquico: 1,
  activo: true,
  fecha_inicio: "2020-01-01",
  fecha_fin: null,
  schema_version: 1,
  creado_en: ts,
  actualizado_en: ts,
});

await db.collection(CFG_ETAPA1_COLLECTION).doc(CFG_ETAPA1_RUNTIME_DOC).set(
  {
    gdt_ids_etapa1: [gdtId],
    etapa1_habilitada: true,
    forzar_catalogo_etapa1: true,
    actualizado_en: new Date().toISOString(),
    nota: "bootstrap-dev-agente — GDT base inicial",
  },
  { merge: true },
);

await applyLaborAwareSessionClaims(uid, perId, usrId);
const profile = await computeLaborProfileForPersona(perId);

console.log("");
console.log("[bootstrap-dev] OK");
console.log(`  Login web: DNI ${dni} + PIN ${pin}`);
console.log(`  Email Auth (no va en pantalla): ${email}`);
console.log(`  persona_id: ${perId}`);
console.log(`  gdt_id: ${gdtId}`);
console.log(`  claims roles: ${JSON.stringify(profile.roles_hlc_vigentes)}`);
console.log(`  cargo_activo: ${profile.cargo_activo}`);
console.log("");
console.log("Arranque: npm run dev:web:dev");
