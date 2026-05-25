/**
 * Auditoría: documentos en Firestore que aún contienen strings iguales a ids de catálogo
 * demo eliminados (FK huérfanas).
 *
 * Solo lectura. Usa GOOGLE_APPLICATION_CREDENTIALS como el resto de scripts Admin.
 *
 * Uso (raíz repo):
 *   npm run db:audit-refs-catalogos-eliminados
 */

import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { FieldPath, getFirestore } from "firebase-admin/firestore";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("[audit-refs] Falta GOOGLE_APPLICATION_CREDENTIALS.");
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
    console.error("[audit-refs] No se pudo resolver project id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(getApp());

/** Ids de demo quitados del seed / borrados de BD (mantener alineado con delete-catalog-demo-docs.mjs). */
const ORPHAN_IDS = new Set([
  "CFG_EST_CIVIL_CASADO",
  "CFG_EST_CIVIL_SOLTERO",
  "CFG_GEN_F",
  "CFG_GEN_M",
  "CFG_NAC_ARG",
  "CFG_PROV_BA",
  "CFG_PROV_CABA",
  "CFG_LOC_LA_PLATA",
  "CFG_EST_SEC",
  "CFG_PAR_CONY",
  "CFG_PAR_HIJO",
  "CFG_ESC_X",
  "CFG_AGR_PROF",
  "CFG_VIN_PERM",
  "CFG_CF_MED",
  "CFG_MOD_FULL",
  "CFG_EST_LAB_VIG",
  "CFG_CAU_FIN_FIN",
  "CFG_ACT_DEC",
  "CFG_REG_HOR_48",
  "CFG_CEN_COST_CTE",
  "gdt_seed_demo_cfg",
  "CFG_EFE_HOSP",
]);

/** Colecciones donde suelen persistirse FK a cfg_* / gdt_* (operativo V2). */
const COLLECTIONS = [
  "personas",
  "usuarios_cuenta",
  "formacion_agente",
  "declaraciones_grupo_familiar",
  "consentimientos",
  "eventos_ticket",
  "historial_laboral_cargos",
  "historial_laboral_datos",
  "historial_laboral_grupos",
  "grupos_de_trabajo",
];

/**
 * @param {string} path
 * @param {unknown} val
 * @param {{ path: string, value: string }[]} hits
 */
function scanValue(path, val, hits) {
  if (val === null || val === undefined) return;
  if (typeof val === "string") {
    if (ORPHAN_IDS.has(val)) hits.push({ path: path || "(root)", value: val });
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((item, i) => scanValue(`${path}[${i}]`, item, hits));
    return;
  }
  if (typeof val === "object") {
    if (typeof /** @type {{ toDate?: () => Date }} */ (val).toDate === "function") return;
    for (const [k, v] of Object.entries(val)) {
      const next = path ? `${path}.${k}` : k;
      scanValue(next, v, hits);
    }
  }
}

/**
 * @param {string} colName
 * @param {number} pageSize
 */
async function scanCollection(colName, pageSize = 400) {
  /** @type {{ docId: string, hits: { path: string, value: string }[] }[]} */
  const withRefs = [];
  let total = 0;
  /** @type {import("firebase-admin/firestore").QueryDocumentSnapshot | null} */
  let lastSnap = null;

  while (true) {
    let q = db.collection(colName).orderBy(FieldPath.documentId()).limit(pageSize);
    if (lastSnap) q = q.startAfter(lastSnap);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      total += 1;
      /** @type {{ path: string, value: string }[]} */
      const hits = [];
      scanValue("", doc.data(), hits);
      if (hits.length) withRefs.push({ docId: doc.id, hits });
    }

    lastSnap = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }

  return { total, withRefs };
}

async function main() {
  console.log("[audit-refs] Buscando referencias a ids huérfanos en", COLLECTIONS.length, "colecciones…\n");

  /** @type {Record<string, { total: number, withRefs: { docId: string, hits: { path: string, value: string }[] }[] }>} */
  const report = {};
  let grandTotalDocs = 0;
  let grandTotalRefs = 0;

  for (const col of COLLECTIONS) {
    try {
      const r = await scanCollection(col);
      grandTotalDocs += r.total;
      report[col] = r;
      const n = r.withRefs.length;
      grandTotalRefs += n;
      if (n) {
        console.log(`— ${col}: ${r.total} docs · ${n} documento(s) con al menos una referencia huérfana`);
      } else {
        console.log(`— ${col}: ${r.total} docs · sin coincidencias`);
      }
    } catch (e) {
      console.error(`— ${col}: ERROR`, e?.message || e);
      report[col] = { error: String(e?.message || e), total: 0, withRefs: [] };
    }
  }

  console.log("\n=== Detalle (solo colecciones con hallazgos) ===\n");
  for (const col of COLLECTIONS) {
    const r = report[col];
    if (!r || r.error || !r.withRefs || r.withRefs.length === 0) continue;
    console.log(`## ${col}`);
    for (const row of r.withRefs) {
      console.log(`  doc: ${row.docId}`);
      for (const h of row.hits) {
        console.log(`    · ${h.path} = ${h.value}`);
      }
    }
    console.log("");
  }

  console.log(
    `=== Resumen ===\nDocumentos escaneados (total filas): ${grandTotalDocs}\nDocumentos con referencia huérfana: ${grandTotalRefs}`,
  );
  if (grandTotalRefs === 0) {
    console.log("No se encontraron strings iguales a los ids demo eliminados en las colecciones auditadas.");
  } else {
    console.log(
      "Revisá cada campo: actualizá el dato a un id vigente en cfg_* / gdt_* o corregí desde el flujo de negocio.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
