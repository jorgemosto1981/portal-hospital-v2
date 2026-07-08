/**
 * Seed / upsert cfg_etapa1/runtime — feature flags Etapa 1.
 * Uso:
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/seed-v2/seed-cfg-etapa1-runtime.mjs
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/seed-v2/seed-cfg-etapa1-runtime.mjs --dry-run
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import {
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
  ETAPA1_RUNTIME_DEFAULTS,
  normalizeEtapa1Runtime,
} from "../../shared/utils/etapa1RuntimeConfig.js";

assertFirestoreSeedAllowed("seed-cfg-etapa1-runtime");

const dryRun = process.argv.includes("--dry-run");

if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_V2_PROJECT_ID || process.env.GCLOUD_PROJECT || "portal-hospital-v2",
  });
}

const db = getFirestore();
const payload = {
  ...normalizeEtapa1Runtime({
    ...ETAPA1_RUNTIME_DEFAULTS,
    // Soft Launch: set etapa1_habilitada true + gdt_ids_etapa1 con GDT nuevos
    etapa1_habilitada: false,
    forzar_catalogo_etapa1: false,
    jefe_gso_habilitado: false,
    lao_habilitada: false,
    licencias_medicas_habilitadas: false,
  }),
  actualizado_en: new Date().toISOString(),
  nota: "Etapa 1 vida real — ver docs/v2/ETAPA1_GO_LIVE_V2.md",
};

const ref = db.collection(CFG_ETAPA1_COLLECTION).doc(CFG_ETAPA1_RUNTIME_DOC);
console.log(`[seed-cfg-etapa1] ${dryRun ? "DRY-RUN " : ""}→ ${ref.path}`);
console.log(JSON.stringify(payload, null, 2));

if (!dryRun) {
  await ref.set(payload, { merge: true });
  console.log("[seed-cfg-etapa1] OK");
}
