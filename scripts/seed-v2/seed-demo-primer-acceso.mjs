/**
 * Crea en **Firestore (proyecto en la nube)** una persona + usuarios_cuenta en estado
 * **pendiente de registro**, como tras `rrhhAltaAgente`, para poder usar `/registro` → `registrarPrimerAcceso`.
 *
 * Requisitos:
 * - `npm run seed:cfg` ya ejecutado (cfg_rol, cfg_estado_*, etc.).
 * - Credenciales: `GOOGLE_APPLICATION_CREDENTIALS` en `.env.v2.local`
 *
 * Variables opcionales:
 * - `DEMO_PRIMER_DNI` (solo dígitos, 6–12) — por defecto `30123456`
 *
 * Uso (raíz del repo):
 *   npm run seed:demo-primer-acceso
 */

import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COL_PERSONAS = "personas";
const COL_USUARIOS_CUENTA = "usuarios_cuenta";
const COL_GRUPOS = "grupos_de_trabajo";

const CFG_PEND_REG = "cfg_eca_pend_reg";
const CFG_EPD_BORR = "cfg_epd_borr";
const ESTADO_PENDIENTE_ONBOARDING = "PENDIENTE_ONBOARDING";

const GRUPO_ID = "gdt_seed_demo";
const ROLE_DEFAULT = "CFG_USUARIO";

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
    console.error("Definí FIREBASE_V2_PROJECT_ID o usá JSON de servicio con project_id.");
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

function normalizeDni(s) {
  return String(s || "").replace(/\D/g, "");
}

async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }
  console.log("[seed-demo-primer-acceso] Escribiendo en Firestore del proyecto (nube) vía credenciales de servicio.");

  const dni = normalizeDni(process.env.DEMO_PRIMER_DNI || "30123456");
  if (!/^\d{6,12}$/.test(dni)) {
    console.error("[seed-demo-primer-acceso] DEMO_PRIMER_DNI debe tener 6–12 dígitos.");
    process.exit(1);
  }

  const existing = await db.collection(COL_PERSONAS).where("dni", "==", dni).limit(1).get();
  if (!existing.empty) {
    const pid = existing.docs[0].id;
    console.log(`[seed-demo-primer-acceso] Ya existe persona con DNI ${dni} (${pid}). No se duplica.`);
    return;
  }

  const t0 = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));
  const gref = db.collection(COL_GRUPOS).doc(GRUPO_ID);
  if (!(await gref.get()).exists) {
    await gref.set(
      {
        id: GRUPO_ID,
        nombre: "Grupo demo (seed primer acceso)",
        activo: true,
        vigente_desde: t0,
        vigente_hasta: null,
        seed_demo: true,
        creado_en: FieldValue.serverTimestamp(),
        actualizado_en: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`[seed-demo-primer-acceso] Creado ${COL_GRUPOS}/${GRUPO_ID}`);
  }

  const perId = `per_seed_${dni}`;
  const usrId = `usr_seed_${dni}`;
  const ts = FieldValue.serverTimestamp();

  const batch = db.batch();
  batch.set(db.collection(COL_PERSONAS).doc(perId), {
    persona_id: perId,
    dni,
    nombre: "Demo",
    apellido: "PrimerAcceso",
    estado: ESTADO_PENDIENTE_ONBOARDING,
    grupo_de_trabajo_id: GRUPO_ID,
    nivel_jerarquico: 1,
    activo: true,
    schema_version: 1,
    estado_perfil_datos_id: CFG_EPD_BORR,
    perfil_completitud_version: 0,
    metadata: { prealta_mvp: true, seed_demo_primer_acceso: true },
    creado_en: ts,
    actualizado_en: ts,
  });
  batch.set(db.collection(COL_USUARIOS_CUENTA).doc(usrId), {
    persona_id: perId,
    auth_uid: null,
    auth_proveedor_id: null,
    username: null,
    activo: true,
    estado_acceso: CFG_PEND_REG,
    role_ids: [ROLE_DEFAULT],
    creado_en: ts,
    actualizado_en: ts,
  });
  await batch.commit();

  console.log(
    `[seed-demo-primer-acceso] ok — DNI ${dni} · persona=${perId} · cuenta=${usrId}. Usá /registro con ese DNI y un correo que **no** exista en Firebase Auth.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
