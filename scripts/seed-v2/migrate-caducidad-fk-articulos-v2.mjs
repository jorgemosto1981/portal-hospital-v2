/**
 * Migra `bloque_acumulacion_sucesion.caducidad_tipo_id` desde filas híbridas en `cfg_tipo_acumulacion`
 * hacia `cfg_tipo_caducidad` (RFC catálogo dedicado).
 *
 * Además, fuerza `cfg_cad_fin_ciclo` en la versión vigente de artículos cuyo núcleo o bloque identidad
 * referencia **Art. 64-A** (patrón `64` + separador opcional + `A`).
 *
 * Uso (raíz del repo, credenciales Admin SDK):
 *   node scripts/seed-v2/migrate-caducidad-fk-articulos-v2.mjs
 *   node scripts/seed-v2/migrate-caducidad-fk-articulos-v2.mjs --apply
 *
 * @see docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json — colección `cfg_tipo_caducidad`
 */
import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY_RUN = !APPLY;

const LEGACY_CADUCIDAD_MAP = {
  cfg_tac_cad_fin_periodo: "cfg_cad_fin_ciclo",
  cfg_tac_cad_sin_caducidad: "cfg_cad_nunca",
};

const CAD_64A = "cfg_cad_fin_ciclo";

/** @param {string | undefined | null} s */
function menciona64A(s) {
  if (s == null || typeof s !== "string") return false;
  return /64\s*[-–]?\s*A\b/i.test(s.trim());
}

/**
 * @param {Record<string, unknown>} core
 * @param {Record<string, unknown>} version
 */
function esArticulo64A(core, version) {
  const bloqueId = version?.bloque_identidad_naturaleza;
  const texts = [
    core?.codigo,
    core?.inciso_normativo,
    bloqueId?.codigo,
    bloqueId?.inciso_normativo,
  ];
  return texts.some(menciona64A);
}

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

async function main() {
  console.log(
    `[migrate-caducidad-fk-articulos-v2] proyecto=${admin.app().options.projectId} modo=${DRY_RUN ? "dry-run" : "APPLY"}\n`,
  );

  const artsSnap = await db.collection("cfg_articulos").get();
  let updates = 0;

  for (const artDoc of artsSnap.docs) {
    const core = artDoc.data() || {};
    const verId = typeof core.version_actual_id === "string" ? core.version_actual_id.trim() : "";
    if (!verId) {
      continue;
    }
    const verRef = artDoc.ref.collection("versiones").doc(verId);
    const verSnap = await verRef.get();
    if (!verSnap.exists) {
      continue;
    }
    const version = verSnap.data() || {};
    const bloque = version.bloque_acumulacion_sucesion;
    const actual =
      bloque && typeof bloque === "object" && typeof bloque.caducidad_tipo_id === "string"
        ? bloque.caducidad_tipo_id.trim()
        : "";

    let next = actual;
    let reason = null;

    if (actual && Object.hasOwn(LEGACY_CADUCIDAD_MAP, actual)) {
      next = LEGACY_CADUCIDAD_MAP[actual];
      reason = `legacy_map ${actual}→${next}`;
    }

    if (esArticulo64A(core, version) && next !== CAD_64A) {
      reason = reason ? `${reason}; art64A→${CAD_64A}` : `art64A→${CAD_64A}`;
      next = CAD_64A;
    }

    if (next === actual) continue;

    updates += 1;

    if (DRY_RUN) {
      console.log(`DRY   ${artDoc.id} / ${verId}  caducidad_tipo_id: "${actual}" → "${next}"  (${reason})`);
      continue;
    }

    await verRef.update({
      "bloque_acumulacion_sucesion.caducidad_tipo_id": next,
    });
    console.log(`APPLY ${artDoc.id} / ${verId}  caducidad_tipo_id: "${actual}" → "${next}"  (${reason})`);
  }

  console.log("\n[resumen]");
  console.log(`  Versiones a actualizar: ${updates}`);
  if (DRY_RUN) {
    console.log("  Re-ejecutá con --apply para escribir en Firestore.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
