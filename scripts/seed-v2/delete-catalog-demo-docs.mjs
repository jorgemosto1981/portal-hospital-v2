/**
 * Elimina de Firestore los documentos de catálogo demo listados abajo (referencia única por colección+id).
 *
 * NO ejecuta por defecto. Requiere en el shell:
 *   ALLOW_CFG_DELETE_DEMO_DOCS_V2=true
 *
 * Además: GOOGLE_APPLICATION_CREDENTIALS (igual que otros scripts Admin).
 *
 * Uso (PowerShell, raíz repo):
 *   $env:ALLOW_CFG_DELETE_DEMO_DOCS_V2="true"; npm run db:delete-catalog-demo-docs
 */

import "../load-env-v2.mjs";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

function assertAllowed() {
  const v = String(process.env.ALLOW_CFG_DELETE_DEMO_DOCS_V2 || "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return;
  console.error(
    "[delete-catalog-demo-docs] BLOQUEADO. Para borrar estos documentos definí:\n  ALLOW_CFG_DELETE_DEMO_DOCS_V2=true",
  );
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("[delete-catalog-demo-docs] Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    return null;
  }
  return null;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("[delete-catalog-demo-docs] No se pudo resolver project id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(getApp());

/** @type {readonly [string, string][]} [colección, id_documento] */
const PAIRS = [
  ["cfg_estado_civil", "CFG_EST_CIVIL_CASADO"],
  ["cfg_estado_civil", "CFG_EST_CIVIL_SOLTERO"],
  ["cfg_sexo_genero", "CFG_GEN_F"],
  ["cfg_sexo_genero", "CFG_GEN_M"],
  ["cfg_nacionalidad", "CFG_NAC_ARG"],
  ["cfg_provincia", "CFG_PROV_BA"],
  ["cfg_provincia", "CFG_PROV_CABA"],
  ["cfg_localidad", "CFG_LOC_LA_PLATA"],
  ["cfg_nivel_estudios", "CFG_EST_SEC"],
  ["cfg_parentesco", "CFG_PAR_CONY"],
  ["cfg_parentesco", "CFG_PAR_HIJO"],
  ["cfg_escalafon", "CFG_ESC_X"],
  ["cfg_agrupamiento", "CFG_AGR_PROF"],
  ["cfg_tipo_vinculo_laboral", "CFG_VIN_PERM"],
  ["cfg_cargo_funcional", "CFG_CF_MED"],
  ["cfg_modalidad_jornada", "CFG_MOD_FULL"],
  ["cfg_estado_asignacion_laboral", "CFG_EST_LAB_VIG"],
  ["cfg_causal_fin_asignacion_laboral", "CFG_CAU_FIN_FIN"],
  ["cfg_tipo_acto_designacion", "CFG_ACT_DEC"],
  ["cfg_regimen_horario", "CFG_REG_HOR_48"],
  ["cfg_centro_costo", "CFG_CEN_COST_CTE"],
  ["grupos_de_trabajo", "gdt_seed_demo_cfg"],
  ["cfg_efectores", "CFG_EFE_HOSP"],
];

async function main() {
  assertAllowed();
  console.log(`[delete-catalog-demo-docs] ${PAIRS.length} documentos a intentar borrar…`);
  let ok = 0;
  let missing = 0;
  let errors = 0;
  for (const [col, id] of PAIRS) {
    const ref = db.collection(col).doc(id);
    try {
      const snap = await ref.get();
      if (!snap.exists) {
        missing += 1;
        console.log(`  (omitido, no existe) ${col}/${id}`);
        continue;
      }
      await ref.delete();
      ok += 1;
      console.log(`  borrado ${col}/${id}`);
    } catch (e) {
      errors += 1;
      console.error(`  ERROR ${col}/${id}:`, e?.message || e);
    }
  }
  console.log(`[delete-catalog-demo-docs] fin — borrados: ${ok}, ya ausentes: ${missing}, errores: ${errors}`);
  if (errors) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
