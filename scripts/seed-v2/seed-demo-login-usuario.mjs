/**
 * Crea un usuario en **Firebase Auth (proyecto real)** y los documentos en **Firestore (nube)**
 * para poder hacer login con DNI + PIN.
 *
 * Sin usuario en Auth, `resolverEmailLoginDni` puede encontrar email en Firestore pero
 * `signInWithEmailAndPassword` falla.
 *
 * Uso (raíz del repo):
 *   npm run seed:demo-login-usuario
 *
 * Variables opcionales (.env.v2.local o entorno):
 *   DEMO_LOGIN_DNI          por defecto 1234567
 *   DEMO_LOGIN_EMAIL        por defecto portal-demo-<DNI>@example.com
 *   DEMO_LOGIN_PIN          6 dígitos, por defecto 123456
 *
 * Requisitos: `GOOGLE_APPLICATION_CREDENTIALS`, y `npm run seed:cfg` (catálogos + cfg_rol).
 */

import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COL_PERSONAS = "personas";
const COL_USUARIOS_CUENTA = "usuarios_cuenta";
const COL_GRUPOS = "grupos_de_trabajo";

const CFG_ECA_ACTIVO = "cfg_eca_activo";
const CFG_EPD_BORR = "cfg_epd_borr";
const ESTADO_ACTIVO_MVP = "ACTIVO";

/** Debe existir en Firestore (véase `npm run seed:cfg` → `grupos_de_trabajo`). */
const GRUPO_ID = "gdt_seed_demo_cfg";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}

function resolveProjectId() {
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

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw) return undefined;
  if (raw === "default" || raw === "(default)") return undefined;
  return raw;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o JSON de servicio con project_id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId
  ? getFirestore(getApp(), nonDefaultDatabaseId)
  : getFirestore();
const auth = getAuth();

function normalizeDni(s) {
  return String(s || "").replace(/\D/g, "");
}

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }
  console.log("[seed-demo-login] Escribiendo en Firestore del proyecto (nube) vía credenciales de servicio.");

  const dni = normalizeDni(process.env.DEMO_LOGIN_DNI || "1234567");
  if (!/^\d{6,12}$/.test(dni)) {
    console.error("[seed-demo-login] DEMO_LOGIN_DNI debe tener 6–12 dígitos.");
    process.exit(1);
  }

  const pin = normalizeDni(process.env.DEMO_LOGIN_PIN || "123456");
  if (!/^\d{6}$/.test(pin)) {
    console.error("[seed-demo-login] DEMO_LOGIN_PIN debe ser exactamente 6 dígitos.");
    process.exit(1);
  }

  const email =
    (process.env.DEMO_LOGIN_EMAIL || "").trim().toLowerCase() ||
    `portal-demo-${dni}@example.com`;

  const gref = db.collection(COL_GRUPOS).doc(GRUPO_ID);
  if (!(await gref.get()).exists) {
    console.warn(
      `[seed-demo-login] No existe ${COL_GRUPOS}/${GRUPO_ID}. Ejecutá antes: npm run seed:cfg.`,
    );
  }

  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password: pin });
    console.log(`[seed-demo-login] Auth: usuario ya existía (${email}), PIN actualizado.`);
  } catch (e) {
    if (e?.code !== "auth/user-not-found") {
      console.error("[seed-demo-login] Auth:", e?.message || e);
      process.exit(1);
    }
    const rec = await auth.createUser({
      email,
      password: pin,
      emailVerified: false,
    });
    uid = rec.uid;
    console.log(`[seed-demo-login] Auth: creado ${email} (uid ${uid}).`);
  }

  const perId = `per_login_${dni}`;
  const usrId = `usr_login_${dni}`;
  const ts = FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(
    db.collection(COL_PERSONAS).doc(perId),
    {
      persona_id: perId,
      dni,
      nombre: "Demo",
      apellido: "Login",
      estado: ESTADO_ACTIVO_MVP,
      grupo_de_trabajo_id: GRUPO_ID,
      nivel_jerarquico: 1,
      activo: true,
      schema_version: 1,
      estado_perfil_datos_id: CFG_EPD_BORR,
      perfil_completitud_version: 0,
      metadata: { seed_demo_login: true },
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: true },
  );

  batch.set(
    db.collection(COL_USUARIOS_CUENTA).doc(usrId),
    {
      persona_id: perId,
      auth_uid: uid,
      auth_proveedor_id: "password",
      username: email,
      activo: true,
      estado_acceso: CFG_ECA_ACTIVO,
      role_ids: ["CFG_USUARIO"],
      creado_en: ts,
      actualizado_en: ts,
    },
    { merge: true },
  );

  await batch.commit();

  console.log("");
  console.log("[seed-demo-login] Firestore ok.");
  console.log(`  DNI: ${dni}`);
  console.log(`  Email (login): ${email}`);
  console.log(`  PIN: ${pin}`);
  console.log(`  persona_id: ${perId}`);
  console.log("");
  console.log("En la web (login): DNI arriba + PIN 6 dígitos. No uses el email en la pantalla de login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
