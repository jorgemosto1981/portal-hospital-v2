/**
 * Smoke C1 — listado paginado bandeja auditor (core vs Firestore piloto).
 *
 *   node scripts/smoke/med-c1-bandeja-auditor-paginacion.mjs
 *   node scripts/smoke/med-c1-bandeja-auditor-paginacion.mjs --dni=28914247
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));

const TAG = "[smoke-med-c1-bandeja]";
const DNI_MOSTO = "28914247";

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

function parseDniArg(argv) {
  const hit = argv.find((a) => a.startsWith("--dni="));
  return hit ? hit.slice("--dni=".length).replace(/\D/g, "") : "";
}

async function main() {
  const { listarSolicitudesBandejaAuditorMedica } = requireFns(
    "./modules/shared/solicitudBandejaAuditorMedicaCore.js",
  );
  const db = initDb();
  const dni = parseDniArg(process.argv.slice(2)) || "";

  const p1 = await listarSolicitudesBandejaAuditorMedica(db, {
    filtro_vista: "completas",
    page_size: 5,
    dni: dni || undefined,
  });

  console.log(TAG, "p1", {
    count: p1.solicitudes.length,
    has_more: p1.page_info?.has_more,
    next_cursor: p1.page_info?.next_cursor,
    order_field: p1.page_info?.order_field,
    batches: p1.page_info?.firestore_batches,
  });

  if (!Array.isArray(p1.solicitudes)) {
    console.error(TAG, "FAIL: sin solicitudes array");
    process.exit(1);
  }

  if (dni && p1.solicitudes.length > 0) {
    const okDni = p1.solicitudes.every(
      (s) => String(s.titular_dni || "").includes(DNI_MOSTO) || dni === DNI_MOSTO,
    );
    if (!okDni) {
      console.error(TAG, "FAIL: DNI path no filtra titular esperado");
      process.exit(1);
    }
  }

  if (p1.page_info?.has_more && p1.page_info?.next_cursor) {
    const p2 = await listarSolicitudesBandejaAuditorMedica(db, {
      filtro_vista: "completas",
      page_size: 5,
      cursor: p1.page_info.next_cursor,
      dni: dni || undefined,
    });
    console.log(TAG, "p2", {
      count: p2.solicitudes.length,
      has_more: p2.page_info?.has_more,
      first_id: p2.solicitudes[0]?.solicitud_id,
    });
    const dup = p2.solicitudes.some((s) =>
      p1.solicitudes.some((a) => a.solicitud_id === s.solicitud_id),
    );
    if (dup) {
      console.error(TAG, "FAIL: cursor duplicó ítems de página 1");
      process.exit(1);
    }
  }

  console.log(TAG, "VEREDICTO: PASS");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
