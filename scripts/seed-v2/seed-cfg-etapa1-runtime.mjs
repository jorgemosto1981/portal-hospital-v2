/**
 * Seed / upsert cfg_etapa1/runtime — feature flags Etapa 1.
 * Uso:
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/seed-v2/seed-cfg-etapa1-runtime.mjs
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/seed-v2/seed-cfg-etapa1-runtime.mjs --dry-run
 */
import "../load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import { getAdminDb } from "../lib/firestoreAdminBootstrap.mjs";
import {
  CFG_ETAPA1_COLLECTION,
  CFG_ETAPA1_RUNTIME_DOC,
  ETAPA1_RUNTIME_DEFAULTS,
  normalizeEtapa1Runtime,
} from "../../shared/utils/etapa1RuntimeConfig.js";

assertFirestoreSeedAllowed("seed-cfg-etapa1-runtime");

const dryRun = process.argv.includes("--dry-run");
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const appliedCambioDiaPath = join(repoRoot, "docs/v2/seeds/cambio_dia/applied-ids.json");

/** @type {string[]} */
const articuloIds = [...ETAPA1_RUNTIME_DEFAULTS.articulo_ids_etapa1];
if (existsSync(appliedCambioDiaPath)) {
  try {
    const applied = JSON.parse(readFileSync(appliedCambioDiaPath, "utf8"));
    const artId = String(applied?.artId || "").trim();
    if (/^art_/i.test(artId) && !articuloIds.includes(artId)) {
      articuloIds.push(artId);
    }
  } catch {
    /* ignore */
  }
}

const db = getAdminDb();
const payload = {
  ...normalizeEtapa1Runtime({
    ...ETAPA1_RUNTIME_DEFAULTS,
    articulo_ids_etapa1: articuloIds,
    // Soft Launch: etapa1_habilitada true. gdt_ids_etapa1 es obsoleto (circuito = GDT activo).
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
