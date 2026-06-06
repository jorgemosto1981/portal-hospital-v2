/**
 * Upsert catálogos asistencia/turnos — Fase A0 (ids fijos desde manifiesto).
 * Uso: node scripts/upsert-cfg-asistencia-turnos-a0.mjs
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_V2_PROJECT_ID
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedRaw = readFileSync(join(__dirname, "seed-v2/seed-ids-asistencia-turnos.v2.json"), "utf8");
const seedIds = JSON.parse(seedRaw.replace(/^\uFEFF/, ""));

const TITULOS = {
  cfg_tipo_compensacion_cobertura: {
    CAMBIO_INTERNO: "Cambio interno (intercambio)",
    EXTRA_PAGA: "Extra pagada",
    DEVOLUCION_HORAS: "Devolución de horas",
  },
  cfg_estado_periodo_liquidacion: {
    ABIERTO: "Período abierto",
    CONCILIADO: "Período en conciliación",
    LIQUIDADO_CERRADO: "Período liquidado (cerrado)",
  },
  cfg_clasificacion_dia_calendario: {
    HABIL: "Día hábil",
    FIN_DE_SEMANA: "Fin de semana",
    FERIADO: "Feriado",
    ASUETO: "Asueto",
    INSTITUCIONAL: "Día institucional",
  },
  cfg_tipo_override_turno: {
    COBERTURA_PARCIAL: "Cobertura parcial de tramo",
  },
};

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;
  try {
    return JSON.parse(readFileSync(credPath, "utf8"))?.project_id || null;
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

async function upsertFila(collection, codigoInterno, docId, orden) {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();
  const titulo_ui = TITULOS[collection]?.[codigoInterno] || codigoInterno;
  const payload = {
    codigo_interno: codigoInterno,
    titulo_ui,
    orden,
    activo: true,
    vigente_desde: null,
    vigente_hasta: null,
    actualizado_en: FieldValue.serverTimestamp(),
  };
  if (!snap.exists) {
    payload.creado_en = FieldValue.serverTimestamp();
    await ref.set(payload);
    console.log(`[upsert-a0] INSERT ${collection}/${docId} (${codigoInterno})`);
  } else {
    await ref.set(payload, { merge: true });
    console.log(`[upsert-a0] MERGE ${collection}/${docId} (${codigoInterno})`);
  }
}

async function main() {
  console.log(`[upsert-a0] project=${projectId} database=${databaseId || "default"}`);
  let orden = 0;
  for (const [collection, map] of Object.entries(seedIds)) {
    if (collection === "projectId" || collection === "generado" || collection === "nota") continue;
    if (typeof map !== "object" || map === null) continue;
    for (const [codigoInterno, docId] of Object.entries(map)) {
      orden += 10;
      await upsertFila(collection, codigoInterno, docId, orden);
    }
  }
  console.log("[upsert-a0] OK");
}

main().catch((err) => {
  console.error("[upsert-a0] ERROR", err);
  process.exit(1);
});
