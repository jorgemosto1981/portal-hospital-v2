/**
 * Upsert cfg_tipo_evento — ART_TOMA_CONOCIMIENTO_REGISTRADA (Oleada A6).
 * Uso: node scripts/upsert-cfg-tipo-evento-tc.mjs
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const CFG_ID = "cfg_tev_art_01ARZ3NDEKTSV4RRFFQ69G5FB8";
const CODIGO_INTERNO = "ART_TOMA_CONOCIMIENTO_REGISTRADA";

const FILA = {
  id: CFG_ID,
  codigo_interno: CODIGO_INTERNO,
  titulo_ui: "Toma de conocimiento registrada",
  descripcion_ui: "RRHH o superior registra toma de conocimiento post-cierre.",
  modulo_origen: "articulos",
  orden: 10,
  activo: true,
  vigente_desde: null,
  vigente_hasta: null,
};

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;
  try {
    const parsed = JSON.parse(readFileSync(credPath, "utf8"));
    return parsed?.project_id || null;
  } catch {
    return null;
  }
}

function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw || raw === "default" || raw === "(default)") return undefined;
  return raw;
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error("Definí FIREBASE_V2_PROJECT_ID o GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const databaseId = resolveNonDefaultDatabaseId();
const db = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore();

async function existePorCodigoInterno() {
  const snap = await db
    .collection("cfg_tipo_evento")
    .where("codigo_interno", "==", CODIGO_INTERNO)
    .limit(5)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function main() {
  console.log(`[upsert-cfg-tc] project=${projectId} database=${databaseId || "default"}`);

  const byId = await db.collection("cfg_tipo_evento").doc(CFG_ID).get();
  if (byId.exists) {
    const data = byId.data() || {};
    console.log("[upsert-cfg-tc] OK — documento por id ya existe:", CFG_ID, data.codigo_interno || "");
    return;
  }

  const porCodigo = await existePorCodigoInterno();
  if (porCodigo.length > 0) {
    console.log(
      "[upsert-cfg-tc] OK — codigo_interno ya presente (otro id):",
      porCodigo.map((x) => x.id).join(", "),
    );
    return;
  }

  await db.collection("cfg_tipo_evento").doc(CFG_ID).set({
    ...FILA,
    actualizado_en: FieldValue.serverTimestamp(),
    creado_en: FieldValue.serverTimestamp(),
  });
  console.log("[upsert-cfg-tc] INSERT —", CFG_ID, CODIGO_INTERNO);
}

main().catch((err) => {
  console.error("[upsert-cfg-tc] ERROR", err);
  process.exit(1);
});
