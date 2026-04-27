/**
 * Seed idempotente de catálogos mínimos V2 (Fase 1).
 * @see docs/v2/MODULO_CONFIGURACION_V2.md §6
 * @see docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md Fase 1
 *
 * Uso (desde la raíz `portal-hospital-v2/`):
 *   Colocá `GOOGLE_APPLICATION_CREDENTIALS` en `.env.v2.local` (carga automática vía `../load-env-v2.mjs`) o en el shell.
 *   npm run seed:cfg
 *
 * Opcionales: FIREBASE_V2_PROJECT_ID, FIREBASE_V2_FIRESTORE_DATABASE_ID (solo base con nombre propio, no "default")
 *
 * La base predefinida se usa con `getFirestore()` sin segundo parámetro (no forzar id "(default)" en el SDK).
 * NOT_FOUND: suele faltar la base en GCP. **Crearla una vez:** `npm run firestore:create` (gcloud) o consola; luego este seed.
 *
 * La cuenta de servicio debe ser de GCP del proyecto V2, rol adecuado p.ej. Cloud Datastore User o Owner.
 */

import "../load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error(
    "Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de cuenta de servicio con acceso a Firestore en V2).",
  );
  process.exit(1);
}

/**
 * projectId **obligatorio** para que Firestore apunte al GCP correcto; sin él, `app.options.projectId` queda
 * vacío y el cliente devuelve NOT_FOUND. Orden: env `FIREBASE_V2_PROJECT_ID` → `project_id` del JSON.
 */
function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch (e) {
    console.error("[seed-v2:cfg] No se pudo leer project_id del JSON de credenciales:", e?.message);
  }
  return null;
}

if (!admin.apps.length) {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.error(
      "Definí FIREBASE_V2_PROJECT_ID o usá un JSON de servicio con campo `project_id`.",
    );
    process.exit(1);
  }
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * Base **no** default (multi-database). Si usás la base normal del proyecto, dejá el env **vacío**.
 * No uses "default" / "(default)" — la base canónica se toma con `getFirestore()` sin 2.º parámetro.
 * @returns {string|undefined}
 */
function resolveNonDefaultDatabaseId() {
  const raw = process.env.FIREBASE_V2_FIRESTORE_DATABASE_ID?.trim();
  if (!raw) return undefined;
  if (raw === "default" || raw === "(default)") return undefined;
  return raw;
}

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId
  ? getFirestore(getApp(), nonDefaultDatabaseId)
  : getFirestore();
const t0 = Timestamp.fromDate(new Date("2020-01-01T00:00:00Z"));

/** Campos comunes de cfg (MODULO_CONFIGURACION §2). */
const base = () => ({
  activo: true,
  vigente_desde: t0,
  vigente_hasta: null,
  seed_version: 1,
  seed_fase: "F1-2026-04",
});

const cfgEstadoCuentaAcceso = () => [
  {
    id: "cfg_eca_pend_reg",
    data: {
      ...base(),
      codigo_interno: "PENDIENTE_REGISTRO",
      titulo_ui: "Pendiente de registro (paso A / primer acceso)",
      orden: 10,
      permite_menu_principal: false,
      requiere_wizard_datos_personales: false,
      permite_login_email_password: false,
    },
  },
  {
    id: "cfg_eca_onb",
    data: {
      ...base(),
      codigo_interno: "ONBOARDING_DATOS",
      titulo_ui: "Onboarding de datos personales",
      orden: 20,
      permite_menu_principal: false,
      requiere_wizard_datos_personales: true,
      permite_login_email_password: true,
    },
  },
  {
    id: "cfg_eca_pend_mail",
    data: {
      ...base(),
      codigo_interno: "PENDIENTE_VERIFICACION_EMAIL",
      titulo_ui: "Pendiente verificación de email",
      orden: 25,
      permite_menu_principal: false,
      requiere_wizard_datos_personales: false,
      permite_login_email_password: true,
    },
  },
  {
    id: "cfg_eca_activo",
    data: {
      ...base(),
      codigo_interno: "ACTIVO_PORTAL",
      titulo_ui: "Activo en el portal",
      orden: 30,
      permite_menu_principal: true,
      requiere_wizard_datos_personales: false,
      permite_login_email_password: true,
    },
  },
  {
    id: "cfg_eca_bloq",
    data: {
      ...base(),
      codigo_interno: "BLOQUEADO",
      titulo_ui: "Bloqueado",
      orden: 90,
      permite_menu_principal: false,
      requiere_wizard_datos_personales: false,
      permite_login_email_password: false,
    },
  },
];

const cfgEstadoPerfilDatos = () => [
  {
    id: "cfg_epd_borr",
    data: {
      ...base(),
      codigo_interno: "BORRADOR",
      titulo_ui: "Borrador",
      orden: 10,
      permite_portal_completo: false,
    },
  },
  {
    id: "cfg_epd_inc",
    data: {
      ...base(),
      codigo_interno: "INCOMPLETO",
      titulo_ui: "Incompleto",
      orden: 20,
      permite_portal_completo: false,
    },
  },
  {
    id: "cfg_epd_comp",
    data: {
      ...base(),
      codigo_interno: "COMPLETO",
      titulo_ui: "Completo",
      orden: 30,
      permite_portal_completo: true,
    },
  },
  {
    id: "cfg_epd_rec",
    data: {
      ...base(),
      codigo_interno: "REQUIERE_ACTUALIZACION",
      titulo_ui: "Requiere actualización (norma nueva)",
      orden: 40,
      permite_portal_completo: false,
    },
  },
];

const cfgTipoEvento = () => [
  {
    id: "cfg_tev_dp_actualizado",
    data: {
      ...base(),
      codigo_interno: "PERSONA_DATOS_ACTUALIZADOS",
      titulo_ui: "Datos de persona actualizados",
      orden: 20,
    },
  },
  {
    id: "cfg_tev_login",
    data: {
      ...base(),
      codigo_interno: "SESION_INICIO",
      titulo_ui: "Inicio de sesión (auditoría)",
      orden: 10,
    },
  },
  {
    id: "cfg_tev_consent",
    data: {
      ...base(),
      codigo_interno: "CONSENTIMIENTO_ACEPTADO",
      titulo_ui: "Consentimiento aceptado o actualizado",
      orden: 30,
    },
  },
];

function applyBatch(items, col) {
  const b = db.batch();
  for (const { id, data } of items) {
    b.set(db.collection(col).doc(id), data, { merge: true });
  }
  return b.commit();
}

async function main() {
  const app = getApp();
  const projectId = app.options?.projectId || "desconocido";
  const dbLabel = nonDefaultDatabaseId
    ? `named=${nonDefaultDatabaseId}`
    : "default (getFirestore sin 2.º id)";
  console.log(`[seed-v2:cfg] project=${projectId} database=${dbLabel}`);

  try {
    const roots = await db.listCollections();
    console.log(
      `[seed-v2:cfg] conexión Firestore ok (listCollections, ${roots.length} raíz/es)`,
    );
  } catch (e) {
    if (e?.code === 5) {
      console.error(
        "[seed-v2:cfg] listCollections → NOT_FOUND. En el proyecto " +
          projectId +
          " no existe aún la base **Firestore (Native)**, o el JSON de servicio no es de este proyecto. Consola: https://console.cloud.google.com/firestore/databases?project=" +
          projectId,
      );
    }
    throw e;
  }

  await applyBatch(cfgEstadoCuentaAcceso(), "cfg_estado_cuenta_acceso");
  await applyBatch(cfgEstadoPerfilDatos(), "cfg_estado_perfil_datos");
  await applyBatch(cfgTipoEvento(), "cfg_tipo_evento");

  const out = {
    projectId,
    generado: new Date().toISOString(),
    cfg_estado_cuenta_acceso: cfgEstadoCuentaAcceso().map((x) => x.id),
    cfg_estado_perfil_datos: cfgEstadoPerfilDatos().map((x) => x.id),
    cfg_tipo_evento: cfgTipoEvento().map((x) => x.id),
  };

  const outPath = join(__dirname, "seed-ids.v2.json");
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[seed-v2:cfg] ok — ids en ${outPath}`);
}

main().catch((e) => {
  if (e?.code === 5 || /NOT_FOUND/i.test(String(e?.message || e))) {
    console.error(
      "[seed-v2:cfg] NOT_FOUND al escribir. Revisá en https://console.cloud.google.com/firestore/databases?project=portal-hospital-v2 que exista la base (modo Native). No definas FIREBASE_V2_FIRESTORE_DATABASE_ID=default; dejá el env vacío salvo otra base con nombre propio.",
    );
  }
  console.error(e);
  process.exit(1);
});
