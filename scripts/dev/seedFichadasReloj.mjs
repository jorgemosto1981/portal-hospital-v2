/**
 * Semilla mínima cfg_reloj_biometrico para probar Fase D (import / huérfanas / enrolamiento).
 *
 * Uso (raíz del repo):
 *   ALLOW_FIRESTORE_SEED_V2=true npm run seed:fichadas-reloj
 *
 * Variables opcionales (.env.v2.local):
 *   FICHADAS_SEED_GDT_ID     — grupo_trabajo_id del reloj (default: gdt_seed_demo_cfg)
 *   FICHADAS_SEED_POLITICA   — EXCLUIR_SEGUNDA | MANTENER_TODAS | BLOQUEAR_APLICAR
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS y un documento existente en grupos_de_trabajo
 * para el gdt elegido (ej. tras seed:demo-login-usuario o grupo real del hospital).
 */

import "../load-env-v2.mjs";
import { assertFirestoreSeedAllowed } from "../seed-v2/guard-no-seed.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

assertFirestoreSeedAllowed("seed-fichadas-reloj");

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_TXT = join(__dirname, "fixtures", "fichadas-import-smoke.txt");

const COL_CFG = "cfg_reloj_biometrico";
const COL_GRUPOS = "grupos_de_trabajo";

const REL_EXCLUIR = "rel_hospital_central_01";
const REL_BLOQUEAR = "rel_hospital_central_02";

const POLITICAS = new Set(["EXCLUIR_SEGUNDA", "MANTENER_TODAS", "BLOQUEAR_APLICAR"]);

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
  if (!raw || raw === "default" || raw === "(default)") return undefined;
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

const dbId = resolveNonDefaultDatabaseId();
const db = dbId ? getFirestore(admin.app(), dbId) : getFirestore();

const gdtDefault = String(process.env.FICHADAS_SEED_GDT_ID || "").trim() || "gdt_seed_demo_cfg";
const politicaPrincipal = POLITICAS.has(String(process.env.FICHADAS_SEED_POLITICA || "").trim())
  ? String(process.env.FICHADAS_SEED_POLITICA).trim()
  : "EXCLUIR_SEGUNDA";

async function assertGrupoExiste(gdtId) {
  const snap = await db.collection(COL_GRUPOS).doc(gdtId).get();
  if (!snap.exists) {
    console.error(
      `El grupo ${gdtId} no existe en ${COL_GRUPOS}. ` +
        `Creá el grupo o exportá FICHADAS_SEED_GDT_ID con un gdt_* válido.`,
    );
    process.exit(1);
  }
}

/**
 * @param {string} id
 * @param {object} body
 */
async function upsertReloj(id, body) {
  const ref = db.collection(COL_CFG).doc(id);
  const exists = (await ref.get()).exists;
  await ref.set(
    {
      ...body,
      id,
      actualizado_en: FieldValue.serverTimestamp(),
      ...(exists ? {} : { creado_en: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  console.log(`  ✓ ${COL_CFG}/${id}`);
}

async function main() {
  console.log("Semilla fichadas reloj V2 (Fase D)…");
  console.log(`  grupo_trabajo_id: ${gdtDefault}`);

  await assertGrupoExiste(gdtDefault);

  await upsertReloj(REL_EXCLUIR, {
    nombre: "Reloj Entrada Principal - Hospital Central (smoke)",
    grupo_trabajo_id: gdtDefault,
    numero_reloj: "001",
    mascara_tokens: "TTTTT DD/MM/YY HH:MM RRR CC",
    politica_validacion: {
      umbral_duplicado_minutos: 2,
      duplicados: politicaPrincipal,
    },
    activo: true,
  });

  await upsertReloj(REL_BLOQUEAR, {
    nombre: "Reloj Secundario - política BLOQUEAR_APLICAR (smoke)",
    grupo_trabajo_id: gdtDefault,
    numero_reloj: "001",
    mascara_tokens: "TTTTT DD/MM/YY HH:MM RRR CC",
    politica_validacion: {
      umbral_duplicado_minutos: 2,
      duplicados: "BLOQUEAR_APLICAR",
    },
    activo: true,
  });

  console.log("\nTXT de humo (copiar a import):");
  console.log(FIXTURE_TXT);
  console.log("\nListo. Rutas UI:");
  console.log("  /portal/rrhh/fichadas-import");
  console.log("  /portal/rrhh/fichadas-huerfanas");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
