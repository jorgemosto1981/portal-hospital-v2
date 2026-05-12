/**
 * Paso 0 Super-LAO — identidad: `es_lao_anual` solo en versión (Bloque 1), no en raíz `cfg_articulos`.
 *
 * Fase 1: eliminar `es_lao_anual` del núcleo (FieldValue.delete).
 * Fase 2: en cada `versiones/*`, si `bloque_identidad_naturaleza` existe y no define `es_lao_anual`,
 *         copiar el valor que tenía la raíz antes del delete.
 * Fase 3: en versiones donde el flag efectivo no es LAO, nullificar campos LAO del Bloque 4.
 *
 * Uso (raíz del repo, Admin SDK):
 *   node scripts/seed-v2/migrate-step0-lao-identity.mjs
 *   node scripts/seed-v2/migrate-step0-lao-identity.mjs --apply
 */
import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY_RUN = !APPLY;
const BATCH_SIZE = 400;

const __dirname = dirname(fileURLToPath(import.meta.url));

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch {
    /* vacío */
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
    console.error("Definí FIREBASE_V2_PROJECT_ID o credenciales con project_id.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db =
  nonDefaultDatabaseId && nonDefaultDatabaseId.length > 0
    ? getFirestore(admin.app(), nonDefaultDatabaseId)
    : getFirestore(admin.app());

async function commitBatches(batches) {
  for (const b of batches) {
    await b.commit();
  }
}

async function main() {
  console.log(
    `[migrate-step0-lao-identity] proyecto=${admin.app().options.projectId} modo=${DRY_RUN ? "dry-run" : "APPLY"}\n`,
  );

  const artsSnap = await db.collection("cfg_articulos").get();
  /** @type {Map<string, boolean>} */
  const rootLaoByArtId = new Map();

  for (const doc of artsSnap.docs) {
    const d = doc.data() || {};
    if (Object.hasOwn(d, "es_lao_anual")) {
      rootLaoByArtId.set(doc.id, d.es_lao_anual === true);
    }
  }

  console.log(`Artículos con campo es_lao_anual en raíz: ${rootLaoByArtId.size}`);

  /** @type {FirebaseFirestore.WriteBatch[]} */
  const phase1Batches = [];
  let p1 = db.batch();
  let p1Ops = 0;
  const pushP1 = () => {
    phase1Batches.push(p1);
    p1 = db.batch();
    p1Ops = 0;
  };

  for (const doc of artsSnap.docs) {
    if (!rootLaoByArtId.has(doc.id)) continue;
    p1.update(doc.ref, { es_lao_anual: FieldValue.delete() });
    p1Ops += 1;
    if (p1Ops >= BATCH_SIZE) pushP1();
  }
  if (p1Ops > 0) pushP1();

  if (DRY_RUN) {
    console.log(`DRY   Fase 1: ${rootLaoByArtId.size} deletes de es_lao_anual en raíz`);
  } else {
    await commitBatches(phase1Batches);
    console.log(`APPLY Fase 1: ${rootLaoByArtId.size} deletes de es_lao_anual en raíz`);
  }

  let phase2Count = 0;
  let phase3Count = 0;
  /** @type {FirebaseFirestore.WriteBatch[]} */
  const verBatches = [];
  let vb = db.batch();
  let vbOps = 0;

  const queueVersionUpdate = (ref, payload) => {
    vb.update(ref, payload);
    vbOps += 1;
    if (vbOps >= BATCH_SIZE) {
      verBatches.push(vb);
      vb = db.batch();
      vbOps = 0;
    }
  };

  for (const artDoc of artsSnap.docs) {
    const artId = artDoc.id;
    const rootLao = rootLaoByArtId.has(artId) ? rootLaoByArtId.get(artId) : undefined;
    const verSnap = await artDoc.ref.collection("versiones").get();

    for (const vdoc of verSnap.docs) {
      const data = vdoc.data() || {};
      const bloqueId = data.bloque_identidad_naturaleza;
      if (!bloqueId || typeof bloqueId !== "object") continue;

      let esLao = bloqueId.es_lao_anual;
      const needsSyncFromRoot = esLao === undefined && rootLao !== undefined;
      if (needsSyncFromRoot) {
        esLao = rootLao;
      }

      const effectiveLao = esLao === true;
      const topes = data.bloque_topes_plazos_computo;
      const hasLaoFields =
        topes &&
        typeof topes === "object" &&
        (topes.correspondencia_anio != null ||
          topes.fecha_corte_antiguedad != null ||
          (Array.isArray(topes.matriz_antiguedad_reglas) && topes.matriz_antiguedad_reglas.length > 0));

      /** @type {Record<string, unknown>} */
      const patch = {};

      if (needsSyncFromRoot) {
        patch.bloque_identidad_naturaleza = { ...bloqueId, es_lao_anual: rootLao };
      }

      if (!effectiveLao && hasLaoFields) {
        patch["bloque_topes_plazos_computo.correspondencia_anio"] = null;
        patch["bloque_topes_plazos_computo.fecha_corte_antiguedad"] = null;
        patch["bloque_topes_plazos_computo.matriz_antiguedad_reglas"] = null;
      }

      if (Object.keys(patch).length === 0) continue;

      if (DRY_RUN) {
        if (needsSyncFromRoot) console.log(`DRY   Fase 2: ${artId} / ${vdoc.id} es_lao_anual ← raíz (${rootLao})`);
        if (!effectiveLao && hasLaoFields) console.log(`DRY   Fase 3: ${artId} / ${vdoc.id} null LAO Bloque 4`);
      } else {
        queueVersionUpdate(vdoc.ref, patch);
        if (needsSyncFromRoot) phase2Count += 1;
        if (!effectiveLao && hasLaoFields) phase3Count += 1;
      }
    }
  }

  if (vbOps > 0) {
    verBatches.push(vb);
  }

  if (!DRY_RUN && verBatches.length > 0) {
    await commitBatches(verBatches);
  }

  console.log("\n[resumen]");
  if (DRY_RUN) {
    console.log("  Modo simulación: no se escribió en Firestore. Re-ejecutá con --apply.");
  } else {
    console.log(`  Fase 2 (sync es_lao desde raíz): ${phase2Count} escrituras`);
    console.log(`  Fase 3 (null LAO en no-LAO): ${phase3Count} escrituras`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
