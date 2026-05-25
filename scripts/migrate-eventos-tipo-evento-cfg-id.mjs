import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const EVENTO_CFG_ID_POR_EVENTO_ID = {
  EVT_LOGIN: "cfg_tev_login",
  EVT_DATOS_NOTIF_CAMBIO_DDJJ: "cfg_tev_datos_notif_cambio_ddjj",
  EVT_DATOS_ACTUALIZA_PERSONAS: "cfg_tev_datos_actualiza_personas",
  EVT_DATOS_ALTA_PERSONAS: "cfg_tev_datos_alta_personas",
  EVT_DATOS_ACTUALIZA_FORMACION: "cfg_tev_datos_actualiza_formacion",
  EVT_DATOS_ALTA_FORMACION: "cfg_tev_datos_alta_formacion",
  EVT_DATOS_ACTUALIZA_DDJJ: "cfg_tev_datos_actualiza_ddjj",
  EVT_DATOS_ALTA_DDJJ: "cfg_tev_datos_alta_ddjj",
  EVT_DATOS_ACTUALIZA_CONSENTIMIENTO: "cfg_tev_datos_actualiza_consentimiento",
  EVT_DATOS_ALTA_CONSENTIMIENTO: "cfg_tev_datos_alta_consentimiento",
  EVT_CONSENTIMIENTO_ACEPTADO: "cfg_tev_consent",
};

function resolveProjectId() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
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

function resolveTipoEventoCfgId(tipoEventoIdRaw) {
  const tipoEventoId = String(tipoEventoIdRaw || "").trim().toUpperCase();
  return EVENTO_CFG_ID_POR_EVENTO_ID[tipoEventoId] || "cfg_tev_datos_notif_cambio_generico";
}

const projectId = resolveProjectId();
if (!projectId) {
  console.error(
    "No se pudo resolver projectId. Definí FIREBASE_V2_PROJECT_ID o GOOGLE_APPLICATION_CREDENTIALS válido.",
  );
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

async function main() {
  console.log(`[migrate:eventos-tipo] project=${projectId} database=${databaseId || "default"}`);
  const snap = await db.collection("eventos_ticket").get();
  console.log(`[migrate:eventos-tipo] eventos leidos=${snap.size}`);

  let yaNormalizados = 0;
  let corregidos = 0;
  let actualizados = 0;
  let sinTipo = 0;
  let batch = db.batch();
  let ops = 0;
  const commits = [];

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const tipoEventoId = String(data.tipo_evento_id || "").trim();
    if (!tipoEventoId) {
      sinTipo += 1;
      continue;
    }
    const tipoEventoCfgId = resolveTipoEventoCfgId(tipoEventoId);
    const tipoCfgIdActual = String(data.tipo_evento_cfg_id || "").trim().toLowerCase();
    if (tipoCfgIdActual) {
      if (tipoCfgIdActual === tipoEventoCfgId) {
        yaNormalizados += 1;
        continue;
      }
      corregidos += 1;
    }
    batch.set(
      doc.ref,
      {
        tipo_evento_cfg_id: tipoEventoCfgId,
      },
      { merge: true },
    );
    actualizados += 1;
    ops += 1;
    if (ops >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) commits.push(batch.commit());
  if (commits.length > 0) await Promise.all(commits);

  console.log(`[migrate:eventos-tipo] ya_normalizados=${yaNormalizados}`);
  console.log(`[migrate:eventos-tipo] corregidos=${corregidos}`);
  console.log(`[migrate:eventos-tipo] actualizados=${actualizados}`);
  console.log(`[migrate:eventos-tipo] sin_tipo_evento_id=${sinTipo}`);
  console.log("[migrate:eventos-tipo] OK");
}

main().catch((err) => {
  console.error("[migrate:eventos-tipo] ERROR", err?.message || err);
  process.exit(1);
});
