/**
 * Dev-only: crea un sub-GDT hijo bajo «grupo base inicial» para probar pase interno.
 * Idempotente: si ya existe un hijo con el mismo nombre, lo reutiliza.
 *
 * Uso (PowerShell):
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   # Opción A — service account -dev:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\…-dev-adminsdk-….json"
 *   # Opción B — sin JSON: usa `gcloud auth print-access-token` (cuenta con acceso a -dev)
 *   node scripts/seed-v2/seed-dev-subgdt-pase.mjs
 *
 * Opcional: SEED_PARENT_GDT_ID · SEED_SUB_GDT_NOMBRE
 */
import "../load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { assertFirestoreSeedAllowed } from "./guard-no-seed.mjs";

assertFirestoreSeedAllowed("seed-dev-subgdt-pase");

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { ulid } = require(join(repoRoot, "web/node_modules/ulid"));

const PROJECT = "portal-hospital-v2-dev";
const PARENT_NOMBRE = "grupo base inicial";
const SUB_NOMBRE = String(process.env.SEED_SUB_GDT_NOMBRE || "subgrupo pase interno").trim();
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function resolveCredPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS_DEV,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ]
    .map((p) => String(p || "").trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  for (const p of candidates) {
    if (!existsSync(p)) {
      console.warn(`[subgdt] Credencial no encontrada: ${p}`);
      continue;
    }
    try {
      const sa = JSON.parse(readFileSync(p, "utf8"));
      if (String(sa.project_id || "").trim() === PROJECT) return p;
      console.warn(`[subgdt] Ignoro SA de proyecto ${sa.project_id} (esperado ${PROJECT}): ${p}`);
    } catch {
      console.warn(`[subgdt] JSON inválido: ${p}`);
    }
  }
  return "";
}

function gcloudAccessToken() {
  const r = spawnSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error(
      `gcloud auth print-access-token falló: ${r.stderr || r.stdout || r.status}`,
    );
  }
  return String(r.stdout || "").trim();
}

function fieldString(v) {
  return { stringValue: String(v) };
}
function fieldBool(v) {
  return { booleanValue: Boolean(v) };
}
function fieldInt(v) {
  return { integerValue: String(Math.trunc(Number(v))) };
}
function fieldNull() {
  return { nullValue: null };
}

async function fsGet(path, token) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fsRunQuery(structuredQuery, token) {
  const res = await fetch(`${FS_BASE}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`runQuery: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fsCreate(collection, docId, fields, token) {
  const res = await fetch(`${FS_BASE}/${collection}?documentId=${encodeURIComponent(docId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`POST ${collection}/${docId}: ${res.status} ${await res.text()}`);
  return res.json();
}

function docFields(doc) {
  return doc?.document?.fields || doc?.fields || {};
}

function strField(fields, key) {
  return String(fields?.[key]?.stringValue || "").trim();
}

function boolField(fields, key) {
  return fields?.[key]?.booleanValue !== false;
}

const credPath = resolveCredPath();
let token = "";
if (credPath) {
  // SA path reserved for future Admin SDK; REST usa token de cuenta.
  console.log(`[subgdt] SA -dev disponible: ${credPath} (usando gcloud token igualmente)`);
}
token = gcloudAccessToken();
console.log(`[subgdt] project=${PROJECT}`);
console.log(`[subgdt] auth=gcloud user token`);

async function resolverPadreId() {
  const forced = String(process.env.SEED_PARENT_GDT_ID || "").trim();
  if (/^gdt_/i.test(forced)) {
    const doc = await fsGet(`grupos_de_trabajo/${forced}`, token);
    if (!doc) throw new Error(`SEED_PARENT_GDT_ID no existe: ${forced}`);
    return forced;
  }

  const byName = await fsRunQuery(
    {
      from: [{ collectionId: "grupos_de_trabajo" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "nombre" },
          op: "EQUAL",
          value: fieldString(PARENT_NOMBRE),
        },
      },
      limit: 5,
    },
    token,
  );
  const docs = (Array.isArray(byName) ? byName : [])
    .map((row) => row.document)
    .filter(Boolean)
    .filter((d) => boolField(d.fields, "activo"));
  if (docs.length >= 1) {
    const id = String(docs[0].name || "").split("/").pop();
    if (docs.length > 1) console.warn(`[subgdt] Varios «${PARENT_NOMBRE}»; uso ${id}`);
    return id;
  }

  const jefeQ = await fsRunQuery(
    {
      from: [{ collectionId: "personas" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "dni" },
          op: "EQUAL",
          value: fieldString("28914247"),
        },
      },
      limit: 1,
    },
    token,
  );
  const jefeDoc = (Array.isArray(jefeQ) ? jefeQ : []).find((r) => r.document)?.document;
  if (!jefeDoc) throw new Error(`No encontré padre «${PARENT_NOMBRE}» ni DNI 28914247.`);
  const perId = String(jefeDoc.name || "").split("/").pop();
  const hlgQ = await fsRunQuery(
    {
      from: [{ collectionId: "historial_laboral_grupos" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "persona_id" },
                op: "EQUAL",
                value: fieldString(perId),
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: "activo" },
                op: "EQUAL",
                value: fieldBool(true),
              },
            },
          ],
        },
      },
      limit: 5,
    },
    token,
  );
  for (const row of Array.isArray(hlgQ) ? hlgQ : []) {
    const gdt = strField(docFields(row), "grupo_de_trabajo_id");
    if (/^gdt_/i.test(gdt)) return gdt;
  }
  throw new Error("No pude resolver GDT padre.");
}

const parentId = await resolverPadreId();
const parentDoc = await fsGet(`grupos_de_trabajo/${parentId}`, token);
const parentFields = parentDoc?.fields || {};
const parentNombre = strField(parentFields, "nombre") || parentId;
console.log(`[subgdt] padre ${parentId} «${parentNombre}»`);

const hijosQ = await fsRunQuery(
  {
    from: [{ collectionId: "grupos_de_trabajo" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "parent_group_id" },
        op: "EQUAL",
        value: fieldString(parentId),
      },
    },
    limit: 40,
  },
  token,
);

const existente = (Array.isArray(hijosQ) ? hijosQ : [])
  .map((r) => r.document)
  .filter(Boolean)
  .find((d) => {
    const n = strField(d.fields, "nombre").toLowerCase();
    return n === SUB_NOMBRE.toLowerCase() && boolField(d.fields, "activo");
  });

if (existente) {
  const id = String(existente.name || "").split("/").pop();
  console.log(`[subgdt] Ya existe hijo ${id} «${SUB_NOMBRE}» — nada que crear.`);
  console.log(`[subgdt] Recargá Plantel: deberías ver el subgrupo bajo «${parentNombre}».`);
  process.exit(0);
}

const childId = `gdt_${ulid()}`;
const nivelPadre = Number(parentFields.nivel_arbol?.integerValue || 1);
await fsCreate(
  "grupos_de_trabajo",
  childId,
  {
    id: fieldString(childId),
    nombre: fieldString(SUB_NOMBRE),
    activo: fieldBool(true),
    parent_group_id: fieldString(parentId),
    nivel_arbol: fieldInt(Number.isFinite(nivelPadre) ? nivelPadre + 1 : 2),
    vigente_desde: fieldString("2020-01-01"),
    vigente_hasta: fieldNull(),
    schema_version: fieldInt(1),
    metadata: {
      mapValue: {
        fields: {
          seed_dev_subgdt_pase: fieldBool(true),
          parent_nombre: fieldString(parentNombre),
        },
      },
    },
  },
  token,
);

console.log(`[subgdt] Creado ${childId} «${SUB_NOMBRE}»`);
console.log(`[subgdt] parent_group_id=${parentId}`);
console.log(`[subgdt] Recargá /portal/jefe/plantel y abrí Pase interno → debería listar el destino.`);
