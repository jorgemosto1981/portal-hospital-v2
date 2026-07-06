/**
 * Smoke C4 — historial LM paginado bandeja auditor.
 *
 *   node scripts/smoke/med-c4-modal-historial-lm.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));

const TAG = "[smoke-med-c4-historial-lm]";
const PER_MOSTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t
          .slice("GOOGLE_APPLICATION_CREDENTIALS=".length)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function initDb() {
  const { cert, getApps, initializeApp } = requireFns("firebase-admin/app");
  const { getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return getFirestore();
}

async function main() {
  const db = initDb();
  const { obtenerHistorialLmTitularBandejaAuditor } = requireFns(
    "./modules/shared/historialLmTitularBandejaAuditorCore.js",
  );

  const preview = await obtenerHistorialLmTitularBandejaAuditor(db, {
    titular_persona_id: PER_MOSTO,
    page_size: 5,
  });
  if (!preview.ok) {
    console.error(TAG, "FAIL preview", preview.codigo);
    process.exit(1);
  }
  console.log(TAG, "preview", {
    items: preview.items.length,
    has_more: preview.has_more,
    total: preview.total_filtrado,
    next: preview.next_cursor,
  });

  if (preview.has_more && preview.next_cursor) {
    const page2 = await obtenerHistorialLmTitularBandejaAuditor(db, {
      titular_persona_id: PER_MOSTO,
      page_size: 20,
      cursor: preview.next_cursor,
    });
    if (!page2.ok || page2.items.length < 1) {
      console.error(TAG, "FAIL page2");
      process.exit(1);
    }
    console.log(TAG, "page2", { items: page2.items.length, has_more: page2.has_more });
  }

  console.log(TAG, "VEREDICTO: PASS");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
