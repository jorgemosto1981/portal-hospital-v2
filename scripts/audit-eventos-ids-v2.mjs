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

const ESTADO_CFG_ID_POR_LEGACY = {
  visto: "cfg_ebr_visto",
  archivado: "cfg_ebr_arch",
  pendiente_revision: "cfg_ebr_pend_rev",
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
  const snap = await db.collection("eventos_ticket").get();
  let missingTipoCfgId = 0;
  let missingEstadoCfgId = 0;
  let tipoInconsistente = 0;
  let estadoInconsistente = 0;
  let tipoEventoNoMapeado = 0;
  const tipoEventoNoMapeadoSet = new Set();
  const muestras = [];

  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const tipoId = String(d.tipo_evento_id || "").trim().toUpperCase();
    const tipoCfg = String(d.tipo_evento_cfg_id || "").trim().toLowerCase();
    const estadoLegacy = String(d.estado_bandeja_rrhh || "").trim().toLowerCase();
    const estadoCfg = String(d.estado_bandeja_rrhh_id || "").trim().toLowerCase();

    if (!tipoCfg) missingTipoCfgId += 1;
    if (!estadoCfg) missingEstadoCfgId += 1;

    const tipoEsperado = EVENTO_CFG_ID_POR_EVENTO_ID[tipoId] || null;
    if (!tipoEsperado) {
      tipoEventoNoMapeado += 1;
      if (tipoId) tipoEventoNoMapeadoSet.add(tipoId);
    } else if (tipoCfg && tipoCfg !== tipoEsperado) {
      tipoInconsistente += 1;
      if (muestras.length < 10) muestras.push({ id: doc.id, campo: "tipo_evento_cfg_id", actual: tipoCfg, esperado: tipoEsperado, tipo_evento_id: tipoId });
    }

    const estadoEsperado = ESTADO_CFG_ID_POR_LEGACY[estadoLegacy] || "cfg_ebr_pend_rev";
    if (estadoCfg && estadoCfg !== estadoEsperado) {
      estadoInconsistente += 1;
      if (muestras.length < 10) muestras.push({ id: doc.id, campo: "estado_bandeja_rrhh_id", actual: estadoCfg, esperado: estadoEsperado, estado_bandeja_rrhh: estadoLegacy || null });
    }
  }

  console.log(`[audit:eventos-ids] project=${projectId} database=${databaseId || "default"}`);
  console.log(`[audit:eventos-ids] total=${snap.size}`);
  console.log(`[audit:eventos-ids] missing_tipo_evento_cfg_id=${missingTipoCfgId}`);
  console.log(`[audit:eventos-ids] missing_estado_bandeja_rrhh_id=${missingEstadoCfgId}`);
  console.log(`[audit:eventos-ids] tipo_inconsistente=${tipoInconsistente}`);
  console.log(`[audit:eventos-ids] estado_inconsistente=${estadoInconsistente}`);
  console.log(`[audit:eventos-ids] tipo_evento_no_mapeado=${tipoEventoNoMapeado}`);
  if (tipoEventoNoMapeadoSet.size > 0) {
    console.log(`[audit:eventos-ids] tipos_no_mapeados=${JSON.stringify([...tipoEventoNoMapeadoSet])}`);
  }
  if (muestras.length > 0) {
    console.log("[audit:eventos-ids] muestras_inconsistencias=");
    console.log(JSON.stringify(muestras, null, 2));
  } else {
    console.log("[audit:eventos-ids] sin inconsistencias detectadas");
  }
}

main().catch((err) => {
  console.error("[audit:eventos-ids] ERROR", err?.message || err);
  process.exit(1);
});
