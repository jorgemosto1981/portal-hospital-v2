/**
 * Seed idempotente — catálogos dominio Artículos V2 desde JSON aprobado.
 *
 * @see docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json
 * @see docs/v2/DICCIONARIO_CFG_ARTICULOS_V2.md
 *
 * Idempotencia: cada documento usa el `id` fijo del JSON; `set` sin merge reemplaza
 * el documento completo en cada ejecución (mismo resultado si corrés N veces; no duplica).
 *
 * Política: `ALLOW_FIRESTORE_SEED_V2=true` (mismo guard que seed-cfg).
 *
 * Uso (raíz del repo):
 *   ALLOW_FIRESTORE_SEED_V2=true npm run seed:catalogos-articulos-v2
 *
 * Simulación (sin escritura):
 *   npm run seed:catalogos-articulos-v2 -- --dry-run
 */

import "../load-env-v2.mjs";
import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY = process.argv.includes("--dry-run");

if (!DRY) {
  assertFirestoreSeedAllowed("seed-catalogos-articulos-v2");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const JSON_PATH = join(repoRoot, "docs", "v2", "SEED_CATALOGOS_ARTICULOS_V2.json");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!DRY && !credPath) {
  console.error(
    "Falta GOOGLE_APPLICATION_CREDENTIALS (o usá --dry-run para validar el JSON sin Firestore).",
  );
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!credPath) return null;
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

if (!DRY && !admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error("Definí FIREBASE_V2_PROJECT_ID o usá credenciales con `project_id`.");
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db =
  !DRY && admin.apps.length
    ? nonDefaultDatabaseId
      ? getFirestore(getApp(), nonDefaultDatabaseId)
      : getFirestore()
    : null;

/** Metadatos de trazabilidad (no sustituyen campos de negocio del JSON). */
const SEED_MARKER = {
  seed_catalogos_articulos_v2: true,
  seed_catalogos_articulos_v2_version: 1,
  seed_catalogos_articulos_v2_escrito_en: FieldValue.serverTimestamp(),
};

const BATCH_MAX = 400;

/**
 * @param {Record<string, unknown>} row
 * @returns {{ id: string, data: Record<string, unknown> }}
 */
function rowToFirestoreDoc(row) {
  if (!row || typeof row !== "object") {
    throw new Error("Fila inválida (no objeto)");
  }
  const id = row.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error(`Fila sin id string: ${JSON.stringify(row).slice(0, 120)}`);
  }
  const { id: _drop, ...rest } = row;
  /** Copia literal del JSON + marcador de seed (fechas calendario quedan string `YYYY-MM-DD` si así vienen). */
  return { id: id.trim(), data: { ...rest, ...SEED_MARKER } };
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} collectionId
 */
async function writeCollectionReplace(rows, collectionId) {
  if (!rows.length) {
    console.log(`[seed-articulos-v2] ${collectionId}: (vacío, skip)`);
    return 0;
  }
  if (DRY) {
    for (const row of rows) {
      rowToFirestoreDoc(row);
    }
    console.log(`[seed-articulos-v2] DRY-RUN ${collectionId}: ${rows.length} docs (ids validados)`);
    return rows.length;
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_MAX) {
    const slice = rows.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const row of slice) {
      const { id, data } = rowToFirestoreDoc(row);
      const ref = db.collection(collectionId).doc(id);
      batch.set(ref, data, { merge: false });
    }
    await batch.commit();
    written += slice.length;
  }
  console.log(`[seed-articulos-v2] ${collectionId}: ${written} docs (set merge:false)`);
  return written;
}

function loadCatalogJson() {
  const raw = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON inválido");
  }
  return raw;
}

async function main() {
  const raw = loadCatalogJson();
  const meta = raw._meta;
  if (meta) {
    console.log(
      `[seed-articulos-v2] fuente: ${Array.isArray(meta.fuente_norma) ? meta.fuente_norma.join(" · ") : "—"}`,
    );
  }

  if (!DRY) {
    const app = getApp();
    const projectId = app.options?.projectId || "desconocido";
    const dbLabel = nonDefaultDatabaseId ? `named=${nonDefaultDatabaseId}` : "default";
    console.log(`[seed-articulos-v2] project=${projectId} database=${dbLabel}`);
    try {
      const roots = await db.listCollections();
      console.log(`[seed-articulos-v2] conexión ok (${roots.length} colecciones raíz)`);
    } catch (e) {
      if (e?.code === 5) {
        console.error(
          "[seed-articulos-v2] NOT_FOUND: revisá proyecto y base Firestore Native.",
        );
      }
      throw e;
    }
  } else {
    console.log("[seed-articulos-v2] modo --dry-run: sin Admin / sin escritura");
  }

  const report = {
    generado: new Date().toISOString(),
    dryRun: DRY,
    jsonPath: JSON_PATH,
    colecciones: {},
  };

  let total = 0;

  for (const [key, value] of Object.entries(raw)) {
    if (key === "_meta") continue;

    if (key === "cfg_tipo_evento_articulos") {
      const filas = value && typeof value === "object" && Array.isArray(value.filas) ? value.filas : null;
      if (!filas) {
        console.warn("[seed-articulos-v2] cfg_tipo_evento_articulos sin .filas — skip");
        continue;
      }
      const n = await writeCollectionReplace(filas, "cfg_tipo_evento");
      report.colecciones.cfg_tipo_evento_desde_json_articulos = n;
      total += n;
      continue;
    }

    if (!Array.isArray(value)) {
      console.warn(`[seed-articulos-v2] clave "${key}" no es array — skip`);
      continue;
    }

    const n = await writeCollectionReplace(value, key);
    report.colecciones[key] = n;
    total += n;
  }

  report.total_documentos = total;

  const outPath = join(__dirname, "seed-catalogos-articulos-v2-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[seed-articulos-v2] ok — total ${total} documentos — reporte: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
