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

/**
 * Roles de aplicación — `usuarios_cuenta.role_ids[]` (FK a documento).
 * @see MODULO_CONFIGURACION_V2.md §5 (cfg_rol), MODULO_DATOS_PERSONALES_V2.md §3.7 (role_ids)
 * @see docs/v2/CUESTIONES_ROLES_MENUS_ARQUITECTURA_V2.md
 */
/** Mínimos para que Configuración (pestaña por defecto: estado civil) no arranque vacía. */
const cfgEstadoCivil = () => [
  {
    id: "CFG_EST_CIVIL_SOLTERO",
    data: {
      ...base(),
      codigo_interno: "SOLTERO",
      nombre: "Soltero/a",
      titulo_ui: "Soltero/a",
      orden: 10,
    },
  },
  {
    id: "CFG_EST_CIVIL_CASADO",
    data: {
      ...base(),
      codigo_interno: "CASADO",
      nombre: "Casado/a",
      titulo_ui: "Casado/a",
      orden: 20,
    },
  },
];

const cfgRol = () => [
  {
    id: "CFG_RRHH",
    data: {
      ...base(),
      codigo_interno: "RRHH",
      titulo_ui: "Recursos Humanos",
      nombre: "Recursos Humanos",
      orden: 10,
    },
  },
  {
    id: "CFG_USUARIO",
    data: {
      ...base(),
      codigo_interno: "USUARIO",
      titulo_ui: "Usuario (agente estándar)",
      nombre: "Usuario (agente estándar)",
      orden: 20,
    },
  },
  {
    id: "CFG_MEDICO",
    data: {
      ...base(),
      codigo_interno: "MEDICO",
      titulo_ui: "Médico / auditoría clínica (según política)",
      nombre: "Médico / auditoría clínica (según política)",
      orden: 30,
    },
  },
  {
    id: "CFG_VISUALIZADOR",
    data: {
      ...base(),
      codigo_interno: "VISUALIZADOR",
      titulo_ui: "Visualizador (solo lectura)",
      nombre: "Visualizador (solo lectura)",
      orden: 40,
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
    id: "cfg_tev_login",
    data: {
      ...base(),
      codigo_interno: "SESION_INICIO",
      titulo_ui: "Inicio de sesión (auditoría)",
      nombre: "Inicio de sesión",
      orden: 10,
      evento_id: "EVT_LOGIN",
    },
  },
  {
    id: "cfg_tev_datos_notif_cambio_ddjj",
    data: {
      ...base(),
      codigo_interno: "DATOS_NOTIF_CAMBIO_DDJJ",
      titulo_ui: "Notificación de cambio en DDJJ",
      nombre: "Notificación cambio DDJJ",
      orden: 40,
      evento_id: "EVT_DATOS_NOTIF_CAMBIO_DDJJ",
    },
  },
  {
    id: "cfg_tev_datos_notif_cambio_generico",
    data: {
      ...base(),
      codigo_interno: "DATOS_NOTIF_CAMBIO_GENERICO",
      titulo_ui: "Notificación de cambio genérico de datos",
      nombre: "Notificación cambio genérico",
      orden: 50,
      evento_id: "EVT_DATOS_NOTIF_CAMBIO",
    },
  },
  {
    id: "cfg_tev_datos_actualiza_personas",
    data: {
      ...base(),
      codigo_interno: "DATOS_ACTUALIZA_PERSONAS",
      titulo_ui: "Actualización de datos personales",
      nombre: "Actualización personas",
      orden: 80,
      evento_id: "EVT_DATOS_ACTUALIZA_PERSONAS",
    },
  },
  {
    id: "cfg_tev_datos_alta_personas",
    data: {
      ...base(),
      codigo_interno: "DATOS_ALTA_PERSONAS",
      titulo_ui: "Alta de persona",
      nombre: "Alta personas",
      orden: 90,
      evento_id: "EVT_DATOS_ALTA_PERSONAS",
    },
  },
  {
    id: "cfg_tev_datos_actualiza_formacion",
    data: {
      ...base(),
      codigo_interno: "DATOS_ACTUALIZA_FORMACION",
      titulo_ui: "Actualización de formación del agente",
      nombre: "Actualización formación",
      orden: 100,
      evento_id: "EVT_DATOS_ACTUALIZA_FORMACION",
    },
  },
  {
    id: "cfg_tev_datos_alta_formacion",
    data: {
      ...base(),
      codigo_interno: "DATOS_ALTA_FORMACION",
      titulo_ui: "Alta de formación del agente",
      nombre: "Alta formación",
      orden: 110,
      evento_id: "EVT_DATOS_ALTA_FORMACION",
    },
  },
  {
    id: "cfg_tev_datos_actualiza_ddjj",
    data: {
      ...base(),
      codigo_interno: "DATOS_ACTUALIZA_DDJJ",
      titulo_ui: "Actualización de DDJJ grupo familiar",
      nombre: "Actualización DDJJ",
      orden: 120,
      evento_id: "EVT_DATOS_ACTUALIZA_DDJJ",
    },
  },
  {
    id: "cfg_tev_datos_alta_ddjj",
    data: {
      ...base(),
      codigo_interno: "DATOS_ALTA_DDJJ",
      titulo_ui: "Alta de DDJJ grupo familiar",
      nombre: "Alta DDJJ",
      orden: 130,
      evento_id: "EVT_DATOS_ALTA_DDJJ",
    },
  },
  {
    id: "cfg_tev_datos_actualiza_consentimiento",
    data: {
      ...base(),
      codigo_interno: "DATOS_ACTUALIZA_CONSENTIMIENTO",
      titulo_ui: "Actualización de consentimiento",
      nombre: "Actualización consentimiento",
      orden: 140,
      evento_id: "EVT_DATOS_ACTUALIZA_CONSENTIMIENTO",
    },
  },
  {
    id: "cfg_tev_datos_alta_consentimiento",
    data: {
      ...base(),
      codigo_interno: "DATOS_ALTA_CONSENTIMIENTO",
      titulo_ui: "Alta de consentimiento",
      nombre: "Alta consentimiento",
      orden: 150,
      evento_id: "EVT_DATOS_ALTA_CONSENTIMIENTO",
    },
  },
  {
    id: "cfg_tev_consent",
    data: {
      ...base(),
      codigo_interno: "CONSENTIMIENTO_ACEPTADO",
      titulo_ui: "Consentimiento aceptado o actualizado",
      nombre: "Consentimiento aceptado",
      orden: 160,
      evento_id: "EVT_CONSENTIMIENTO_ACEPTADO",
    },
  },
  {
    id: "cfg_tev_auth_email_cambio_solicitado",
    data: {
      ...base(),
      codigo_interno: "AUTH_EMAIL_CAMBIO_SOLICITADO",
      titulo_ui: "Cambio de correo solicitado",
      nombre: "Cambio correo solicitado",
      orden: 170,
      evento_id: "EVT_AUTH_EMAIL_CAMBIO_SOLICITADO",
    },
  },
  {
    id: "cfg_tev_auth_email_cambio_confirmado",
    data: {
      ...base(),
      codigo_interno: "AUTH_EMAIL_CAMBIO_CONFIRMADO",
      titulo_ui: "Cambio de correo confirmado",
      nombre: "Cambio correo confirmado",
      orden: 180,
      evento_id: "EVT_AUTH_EMAIL_CAMBIO_CONFIRMADO",
    },
  },
  {
    id: "cfg_tev_auth_password_cambio",
    data: {
      ...base(),
      codigo_interno: "AUTH_PASSWORD_CAMBIO",
      titulo_ui: "Cambio de contraseña",
      nombre: "Cambio contraseña",
      orden: 190,
      evento_id: "EVT_AUTH_PASSWORD_CAMBIO",
    },
  },
];

const cfgEstadoBandejaRrhh = () => [
  cfgRow("cfg_ebr_pend_rev", "PENDIENTE_REVISION", "Pendiente de revisión RRHH", 10),
  cfgRow("cfg_ebr_visto", "VISTO", "Visto por RRHH", 20),
  cfgRow("cfg_ebr_arch", "ARCHIVADO", "Archivado", 30),
];

const cfgEstadoDeclaracionDdjj = () => [
  cfgRow("CFG_DDJJ_01_NO_INICIADA", "NO_INICIADA", "No iniciada", 10),
  cfgRow("CFG_DDJJ_02_OMITIDA_ONBOARDING", "OMITIDA_ONBOARDING", "Omitida en onboarding", 20),
  cfgRow("CFG_DDJJ_03_PRESENTADA", "PRESENTADA", "Presentada", 30),
  cfgRow(
    "CFG_DDJJ_04_SUPERADA_POR_ACTUALIZACION",
    "SUPERADA_POR_ACTUALIZACION",
    "Superada por actualización",
    40,
  ),
];

/** Una fila de catálogo cfg_* con nombre/código (demostración local). */
function cfgRow(id, codigo_interno, nombre, orden = 10, extra = {}) {
  return {
    id,
    data: {
      ...base(),
      codigo_interno,
      nombre,
      titulo_ui: nombre,
      orden,
      ...extra,
    },
  };
}

/** Catálogos adicionales de `configuracionCatalogos.js` — mínimos para listas no vacías en Configuración. */
const cfgSexoGenero = () => [
  cfgRow("CFG_GEN_M", "M", "Masculino", 10),
  cfgRow("CFG_GEN_F", "F", "Femenino", 20),
];

const cfgNacionalidad = () => [cfgRow("CFG_NAC_ARG", "ARG", "Argentina", 10)];

const cfgPais = () => [cfgRow("CFG_PAIS_ARG", "ARG", "Argentina", 10)];

const cfgProvincia = () => [
  cfgRow("CFG_PROV_BA", "BA", "Buenos Aires", 10),
  cfgRow("CFG_PROV_CABA", "CABA", "Ciudad Autónoma de Buenos Aires", 20),
];

const cfgLocalidad = () => [
  cfgRow("CFG_LOC_LA_PLATA", "LA_PLATA", "La Plata", 10, { provincia_id: "CFG_PROV_BA" }),
];

const cfgNivelEstudios = () => [
  cfgRow("CFG_EST_SEC", "SECUNDARIO", "Secundario completo", 10),
  cfgRow("CFG_EST_UNI", "UNIVERSITARIO", "Universitario", 20),
];

const cfgEspecialidad = () => [cfgRow("CFG_ESP_CLIN", "CLINICA_MEDICA", "Clínica médica", 10)];

const cfgColegio = () => [cfgRow("CFG_COL_CMP", "CMP", "Colegio de Médicos — demo", 10)];

const cfgJurisdiccionMatricula = () => [
  cfgRow("CFG_JUR_PBA", "PBA", "Provincia de Buenos Aires", 10),
];

const cfgParentesco = () => [
  cfgRow("CFG_PAR_HIJO", "HIJO", "Hijo/a", 10),
  cfgRow("CFG_PAR_CONY", "CONYUGE", "Cónyuge", 20),
];

const cfgMotivoBajaPersona = () => [
  cfgRow("CFG_MOT_BAJA_FIN", "FIN_CONTRATO", "Fin de contrato", 10),
];

const cfgEscalafon = () => [cfgRow("CFG_ESC_X", "GENERAL", "Escalafón general", 10)];

const cfgAgrupamiento = () => [cfgRow("CFG_AGR_PROF", "PROF", "Profesional", 10)];

const cfgTipoVinculoLaboral = () => [
  cfgRow("CFG_VIN_PERM", "PERMANENTE", "Permanente", 10),
];

const cfgCargoFuncional = () => [cfgRow("CFG_CF_MED", "MEDICO", "Médico", 10)];

const cfgModalidadJornada = () => [
  cfgRow("CFG_MOD_FULL", "COMPLETA", "Jornada completa", 10),
];

const cfgEstadoAsignacionLaboral = () => [
  cfgRow("CFG_EST_LAB_VIG", "VIGENTE", "Vigente", 10),
];

const cfgCausalFinAsignacionLaboral = () => [
  cfgRow("CFG_CAU_FIN_FIN", "FIN_VIGENCIA", "Fin de vigencia", 10),
];

const cfgTipoActoDesignacion = () => [
  cfgRow("CFG_ACT_DEC", "DECRETO", "Decreto", 10),
];

const cfgRegimenHorario = () => [
  cfgRow("CFG_REG_HOR_48", "48_HS", "48 horas semanales", 10),
];

const cfgCentroCosto = () => [
  cfgRow("CFG_CEN_COST_CTE", "CTE001", "Centro de costo demo", 10),
];

const cfgEfectores = () => [
  cfgRow("CFG_EFE_HOSP", "HOSP_DEMO", "Hospital demo", 10),
];

const gruposDeTrabajoSeed = () => [
  {
    id: "gdt_seed_demo_cfg",
    data: {
      ...base(),
      id: "gdt_seed_demo_cfg",
      nombre: "Grupo demo (seed cfg)",
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
  await applyBatch(cfgEstadoBandejaRrhh(), "cfg_estado_bandeja_rrhh");
  await applyBatch(cfgEstadoDeclaracionDdjj(), "cfg_estado_declaracion_ddjj");
  await applyBatch(cfgRol(), "cfg_rol");
  await applyBatch(cfgEstadoCivil(), "cfg_estado_civil");

  await applyBatch(cfgSexoGenero(), "cfg_sexo_genero");
  await applyBatch(cfgNacionalidad(), "cfg_nacionalidad");
  await applyBatch(cfgPais(), "cfg_pais");
  await applyBatch(cfgProvincia(), "cfg_provincia");
  await applyBatch(cfgLocalidad(), "cfg_localidad");
  await applyBatch(cfgNivelEstudios(), "cfg_nivel_estudios");
  await applyBatch(cfgEspecialidad(), "cfg_especialidad");
  await applyBatch(cfgColegio(), "cfg_colegio");
  await applyBatch(cfgJurisdiccionMatricula(), "cfg_jurisdiccion_matricula");
  await applyBatch(cfgParentesco(), "cfg_parentesco");
  await applyBatch(cfgMotivoBajaPersona(), "cfg_motivo_baja_persona");
  await applyBatch(cfgEscalafon(), "cfg_escalafon");
  await applyBatch(cfgAgrupamiento(), "cfg_agrupamiento");
  await applyBatch(cfgTipoVinculoLaboral(), "cfg_tipo_vinculo_laboral");
  await applyBatch(cfgCargoFuncional(), "cfg_cargo_funcional");
  await applyBatch(cfgModalidadJornada(), "cfg_modalidad_jornada");
  await applyBatch(cfgEstadoAsignacionLaboral(), "cfg_estado_asignacion_laboral");
  await applyBatch(cfgCausalFinAsignacionLaboral(), "cfg_causal_fin_asignacion_laboral");
  await applyBatch(cfgTipoActoDesignacion(), "cfg_tipo_acto_designacion");
  await applyBatch(cfgRegimenHorario(), "cfg_regimen_horario");
  await applyBatch(cfgCentroCosto(), "cfg_centro_costo");
  await applyBatch(cfgEfectores(), "cfg_efectores");
  await applyBatch(gruposDeTrabajoSeed(), "grupos_de_trabajo");

  const out = {
    projectId,
    generado: new Date().toISOString(),
    cfg_estado_cuenta_acceso: cfgEstadoCuentaAcceso().map((x) => x.id),
    cfg_estado_perfil_datos: cfgEstadoPerfilDatos().map((x) => x.id),
    cfg_tipo_evento: cfgTipoEvento().map((x) => x.id),
    cfg_estado_bandeja_rrhh: cfgEstadoBandejaRrhh().map((x) => x.id),
    cfg_estado_declaracion_ddjj: cfgEstadoDeclaracionDdjj().map((x) => x.id),
    cfg_rol: cfgRol().map((x) => x.id),
    cfg_estado_civil: cfgEstadoCivil().map((x) => x.id),
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
