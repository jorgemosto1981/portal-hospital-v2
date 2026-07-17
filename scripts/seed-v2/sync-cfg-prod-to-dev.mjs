/**
 * Sincroniza catálogos de configuración (configurador de artículos) prod → −dev.
 *
 * - Origen (solo lectura): portal-hospital-v2
 * - Destino (escritura):   portal-hospital-v2-dev  ← CANDADO obligatorio
 * - Por defecto: --dry-run (no escribe)
 *
 * Credenciales (JSON en disco; gitignored — ver .gitignore portal-hospital-v2-*.json):
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS_PROD="C:\DATOS\portal-hospital-v2-4885ffb02c61.json"
 *   $env:GOOGLE_APPLICATION_CREDENTIALS_DEV="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
 *
 * Uso:
 *   node scripts/seed-v2/sync-cfg-prod-to-dev.mjs
 *   node scripts/seed-v2/sync-cfg-prod-to-dev.mjs --dry-run
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/sync-cfg-prod-to-dev.mjs --apply
 *   node scripts/seed-v2/sync-cfg-prod-to-dev.mjs --apply --only articulos
 *   node scripts/seed-v2/sync-cfg-prod-to-dev.mjs --apply --only catalogos
 */
import "../load-env-v2.mjs";

import { initProdReadDevWriteFirestore, PROJECT_DEV } from "../lib/firestoreAdminDual.mjs";
import { createBatchWriter } from "../lib/firestoreSyncBatch.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import {
  CFG_ARTICULOS_COLLECTION,
  CFG_ARTICULOS_VERSIONES_SUB,
  CFG_CATALOG_COLLECTIONS,
  CFG_SYNC_EXCLUDED,
} from "./cfg-catalog-collections.mjs";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY || process.argv.includes("--dry-run");

const onlyArg = (() => {
  const i = process.argv.indexOf("--only");
  if (i < 0) return "all";
  return String(process.argv[i + 1] || "all").trim().toLowerCase();
})();

const collectionsArg = (() => {
  const i = process.argv.indexOf("--collections");
  if (i < 0) return null;
  return String(process.argv[i + 1] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
})();

if (APPLY) {
  assertFirestoreSeedAllowed("sync-cfg-prod-to-dev");
}

/** @type {Record<string, number>} */
const stats = {
  docs: 0,
  writes: 0,
  batches: 0,
  collections: 0,
  articulos: 0,
  versiones: 0,
};

/**
 * @param {FirebaseFirestore.Firestore} srcDb
 * @param {FirebaseFirestore.Firestore} destDb
 * @param {ReturnType<typeof createBatchWriter>} writer
 * @param {string[]} collectionNames
 */
async function sincronizarCatalogosSimples(srcDb, destDb, writer, collectionNames) {
  for (const colName of collectionNames) {
    if (CFG_SYNC_EXCLUDED.includes(colName)) {
      console.log(`[skip] ${colName} (excluida por política)`);
      continue;
    }
    const snap = await srcDb.collection(colName).get();
    console.log(`[catalogo] ${colName}: ${snap.size} doc(s) en prod`);
    stats.collections += 1;
    for (const doc of snap.docs) {
      const destRef = destDb.collection(colName).doc(doc.id);
      await writer.set(destRef, doc.data());
    }
  }
}

/**
 * cfg_articulos + subcolección versiones (núcleo del configurador).
 *
 * @param {FirebaseFirestore.Firestore} srcDb
 * @param {FirebaseFirestore.Firestore} destDb
 * @param {ReturnType<typeof createBatchWriter>} writer
 */
async function sincronizarArticulos(srcDb, destDb, writer) {
  const artsSnap = await srcDb.collection(CFG_ARTICULOS_COLLECTION).get();
  console.log(`[articulos] ${CFG_ARTICULOS_COLLECTION}: ${artsSnap.size} doc(s) en prod`);

  for (const artDoc of artsSnap.docs) {
    stats.articulos += 1;
    const artRef = destDb.collection(CFG_ARTICULOS_COLLECTION).doc(artDoc.id);
    await writer.set(artRef, artDoc.data());

    const versSnap = await srcDb
      .collection(CFG_ARTICULOS_COLLECTION)
      .doc(artDoc.id)
      .collection(CFG_ARTICULOS_VERSIONES_SUB)
      .get();

    if (versSnap.size > 0) {
      console.log(
        `  · ${artDoc.id}: ${versSnap.size} versión(es)`,
      );
    }

    for (const verDoc of versSnap.docs) {
      stats.versiones += 1;
      const verRef = artRef.collection(CFG_ARTICULOS_VERSIONES_SUB).doc(verDoc.id);
      await writer.set(verRef, verDoc.data());
    }
  }
}

/**
 * @param {FirebaseFirestore.Firestore} srcDb
 * @param {FirebaseFirestore.Firestore} destDb
 * @param {boolean} dryRun
 */
async function orquestarSync(srcDb, destDb, dryRun) {
  const writer = createBatchWriter(destDb, { dryRun, stats });

  const catalogList = collectionsArg?.length
    ? collectionsArg.filter((c) => c !== CFG_ARTICULOS_COLLECTION)
    : [...CFG_CATALOG_COLLECTIONS];

  const syncCatalogos = onlyArg === "all" || onlyArg === "catalogos";
  const syncArticulos = onlyArg === "all" || onlyArg === "articulos";

  if (syncCatalogos) {
    await sincronizarCatalogosSimples(srcDb, destDb, writer, catalogList);
  }

  if (syncArticulos) {
    await sincronizarArticulos(srcDb, destDb, writer);
  }

  await writer.commit();
}

async function main() {
  console.log(
    JSON.stringify(
      {
        modo: DRY_RUN ? "dry-run" : "apply",
        destino_forzado: PROJECT_DEV,
        only: onlyArg,
        collections_override: collectionsArg,
        catalogos_definidos: CFG_CATALOG_COLLECTIONS.length,
      },
      null,
      2,
    ),
  );

  const { srcDb, destDb, srcProjectId, destProjectId } = initProdReadDevWriteFirestore();

  console.log(`[candado] origen=${srcProjectId} → destino=${destProjectId} (OK)`);

  if (destProjectId !== PROJECT_DEV) {
    console.error("[CANDADO] Destino no es −dev. Abortado.");
    process.exit(2);
  }

  await orquestarSync(srcDb, destDb, DRY_RUN);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: DRY_RUN,
        stats,
        nota: DRY_RUN
          ? "Ningún documento escrito. Usá --apply con ALLOW_FIRESTORE_SEED_V2=true para persistir."
          : `Escritura completada en ${PROJECT_DEV}. cfg_etapa1/runtime NO se tocó (allowlist −dev).`,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[sync-cfg-prod-to-dev] ERROR:", err?.message || err);
  process.exit(1);
});
