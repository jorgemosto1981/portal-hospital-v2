/**
 * Seed de catálogos base cfg_* — Database-First.
 * Carga `GOOGLE_APPLICATION_CREDENTIALS` (y otras claves) desde `.env.v2.local` en la raíz
 * (ver `../scripts/load-env-v2.mjs`); podés anular con variables ya definidas en el shell.
 *
 * Uso (raíz `portal-hospital-v2/`):
 *   Asegurate de tener en `.env.v2.local` la ruta al JSON (ver comentario en .env.v2.example).
 *   ALLOW_FIRESTORE_SEED_V2=true npm run seed:configuracion
 *
 *   Opcional: $env:FIREBASE_V2_PROJECT_ID en .env o en shell si el JSON no trae project_id.
 */

import "../../scripts/load-env-v2.mjs";
import { assertFirestoreSeedAllowed } from "../../scripts/seed-v2/guard-no-seed.mjs";
import { readFileSync } from "node:fs";

import { getApp } from "firebase-admin/app";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

assertFirestoreSeedAllowed("seed:configuracion");

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error(
    "Falta GOOGLE_APPLICATION_CREDENTIALS (JSON de cuenta de servicio con acceso a Firestore).",
  );
  process.exit(1);
}

function resolveProjectId() {
  const fromEnv = process.env.FIREBASE_V2_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const j = JSON.parse(readFileSync(credPath, "utf8"));
    if (j.project_id) return j.project_id;
  } catch (e) {
    console.error(
      "[seedConfiguracion] No se pudo leer project_id del JSON de credenciales:",
      e?.message,
    );
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

const nonDefaultDatabaseId = resolveNonDefaultDatabaseId();
const db = nonDefaultDatabaseId
  ? getFirestore(getApp(), nonDefaultDatabaseId)
  : getFirestore();

function docData(id, nombre) {
  return {
    id,
    nombre,
    activo: true,
    vigente_desde: null,
    vigente_hasta: null,
  };
}

/** Misma base + `orden` (1 = Lunes … 7 = Domingo, estilo arquitectura). */
function docDataDiaSemana(id, nombre, orden) {
  return { ...docData(id, nombre), orden };
}

/** Misma base + `provincia_id` (FK a `cfg_provincia` / id de documento). */
function docDataLocalidad(id, nombre, provincia_id) {
  return { ...docData(id, nombre), provincia_id };
}

const CFG_ESTADO_CIVIL = [
  ["CFG_EST_CIVIL_01_SOLTERO", "Soltero"],
  ["CFG_EST_CIVIL_02_CASADO", "Casado"],
  ["CFG_EST_CIVIL_03_DIVORCIADO", "Divorciado"],
  ["CFG_EST_CIVIL_04_VIUDO", "Viudo"],
];

const CFG_SEXO_GENERO = [
  ["CFG_GEN_01_MASCULINO", "Masculino"],
  ["CFG_GEN_02_FEMENINO", "Femenino"],
  ["CFG_GEN_03_X", "X / No binario"],
];

const CFG_TIPO_VINCULO_LABORAL = [
  ["CFG_VIN_01_TITULAR", "Titular / Planta Permanente"],
  ["CFG_VIN_02_INTERINO", "Suplente Interino"],
  ["CFG_VIN_03_REEMPLAZO", "Suplente Reemplazante"],
  ["CFG_VIN_04_CONTRATO", "Contratado"],
];

const CFG_ESCALAFON = [
  ["CFG_ESC_01_PROFESIONAL", "Profesional de la Salud (Ley 9282)"],
  ["CFG_ESC_02_ADMINISTRACION", "Administración Pública (Decreto 2695)"],
];

const CFG_CARGO_FUNCIONAL = [
  ["CFG_CAR_01_MEDICO", "Médico"],
  ["CFG_CAR_02_ENFERMERO", "Enfermero"],
  ["CFG_CAR_03_ADMINISTRATIVO", "Administrativo"],
  ["CFG_CAR_04_JEFE_SERVICIO", "Jefe de Servicio"],
];

/** [id, nombre, orden] — ISO-style 1 = Lunes … 7 = Domingo. */
const CFG_DIA_SEMANA = [
  ["CFG_DIA_1", "Lunes", 1],
  ["CFG_DIA_2", "Martes", 2],
  ["CFG_DIA_3", "Miércoles", 3],
  ["CFG_DIA_4", "Jueves", 4],
  ["CFG_DIA_5", "Viernes", 5],
  ["CFG_DIA_6", "Sábado", 6],
  ["CFG_DIA_7", "Domingo", 7],
];

/** Catálogo aptitud psicofísica (colección `cfg_aptitud_psicofisica`). */
const CFG_APTITUD_PSICOFISICA = [
  ["APTPSICO_01_ABSOLUTO", "Absoluto"],
  ["APTPSICO_02_RELATIVO", "Relativo"],
  ["APTPSICO_03_ENTRAMITE", "En Trámite"],
  ["APTPSICO_04_CONDICIONAL", "Condicional"],
];

/**
 * Agrupamiento (colección `cfg_agrupamiento`).
 * Mismo esquema que el resto de `cfg_*`: { id, nombre, activo, vigente_desde, vigente_hasta }.
 * IDs: prefijo fijo `CFG_AGR_` + ordinal + slug estable (FK para personas/historial laboral).
 */
const CFG_AGRUPAMIENTO = [
  ["CFG_AGR_01_ADMINISTRATIVO", "Administrativo"],
  ["CFG_AGR_02_PROFESIONAL", "Profesional"],
  ["CFG_AGR_03_TECNICO", "Técnico"],
  ["CFG_AGR_04_HOSPITALARIO_ASISTENCIAL", "Hospitalario-Asistencial"],
  [
    "CFG_AGR_05_SISTEMA_PROVINCIAL_INFORMATICA",
    "Sistema Provincial de Informática (S.P.I.)",
  ],
  ["CFG_AGR_06_CULTURAL", "Cultural"],
  ["CFG_AGR_07_MANTENIMIENTO_PRODUCCION", "Mantenimiento y Producción"],
  ["CFG_AGR_08_SERVICIOS_GENERALES", "Servicios Generales"],
  ["CFG_AGR_09_LEGISLATIVO", "Legislativo"],
  ["CFG_AGR_10_PERSONAL_NO_DOCENTE", "Personal no Docente"],
  [
    "CFG_AGR_11_PILOTO_AERONAUTICO_EST_PROV_DEC501_97",
    "Piloto Aeronáutico del Estado Provincial Creado por Decreto 501/97",
  ],
  [
    "CFG_AGR_12_ASISTENTES_ESCOLARES_DEC516_10",
    "Asistentes Escolares Creado por Decreto 516/10",
  ],
  [
    "CFG_AGR_13_JUSTICIA_PENAL_JUVENIL_DEC3467_12",
    "Justicia Penal Juvenil Creado por Decreto 3467/12",
  ],
  ["CFG_AGR_14_ASISTENCIAL_COMUNITARIO", "Asistencial Comunitario"],
];

/**
 * Efectores (catálogo de referencia) — `cfg_efectores`.
 * Mismo esquema `docData`.
 */
const CFG_EFECTORES = [
  ["CFG_EFE_01_SAMCO_DE_MONJE", "SAMCO de Monje"],
  ["CFG_EFE_02_COLONIA_PSIQUIATRICA_OLIVEROS", "Colonia Psiquiátrica de Oliveros"],
];

/**
 * Categorías numéricas (1–9) — `cfg_categorias`.
 * `nombre` = etiqueta en UI: "1" … "9" (mismo esquema `docData`).
 */
const CFG_CATEGORIAS = [
  ["CFG_CAT_01", "1"],
  ["CFG_CAT_02", "2"],
  ["CFG_CAT_03", "3"],
  ["CFG_CAT_04", "4"],
  ["CFG_CAT_05", "5"],
  ["CFG_CAT_06", "6"],
  ["CFG_CAT_07", "7"],
  ["CFG_CAT_08", "8"],
  ["CFG_CAT_09", "9"],
];

const CFG_NACIONALIDAD = [
  ["CFG_NAC_01_ARGENTINA", "Argentina"],
  ["CFG_NAC_02_EXTRANJERA", "Extranjera"],
];

const CFG_PROVINCIA = [
  ["CFG_PROV_01_SANTA_FE", "Santa Fe"],
  ["CFG_PROV_02_ENTRE_RIOS", "Entre Ríos"],
  ["CFG_PROV_03_CORDOBA", "Córdoba"],
  ["CFG_PROV_04_BUENOS_AIRES", "Buenos Aires"],
];

/** [id, nombre, provincia_id] */
const CFG_LOCALIDAD = [
  ["CFG_LOC_01_MONJE", "Monje", "CFG_PROV_01_SANTA_FE"],
  ["CFG_LOC_02_BARRANCAS", "Barrancas", "CFG_PROV_01_SANTA_FE"],
  ["CFG_LOC_03_MACIEL", "Maciel", "CFG_PROV_01_SANTA_FE"],
  ["CFG_LOC_04_ROSARIO", "Rosario", "CFG_PROV_01_SANTA_FE"],
  ["CFG_LOC_05_SANTA_FE", "Santa Fe (Capital)", "CFG_PROV_01_SANTA_FE"],
];

const CFG_NIVEL_ESTUDIOS = [
  ["CFG_EST_01_PRIMARIO_INC", "Primario Incompleto"],
  ["CFG_EST_02_PRIMARIO_COM", "Primario Completo"],
  ["CFG_EST_03_SECUNDARIO_INC", "Secundario Incompleto"],
  ["CFG_EST_04_SECUNDARIO_COM", "Secundario Completo"],
  ["CFG_EST_05_TERCIARIO", "Terciario / Pregrado"],
  ["CFG_EST_06_UNIVERSITARIO", "Universitario / Grado"],
];

const CFG_PARENTESCO = [
  ["CFG_PAR_01_CONYUGE", "Cónyuge"],
  ["CFG_PAR_02_CONCUBINO", "Concubino/a"],
  ["CFG_PAR_03_HIJO", "Hijo/a"],
  ["CFG_PAR_04_PADRE_MADRE", "Padre / Madre"],
];

/** Laboral avanzado — módulo laboral §6 / `MODULO_DATOS_LABORALES_V2` (sin `cfg_nivel_jerarquia`; nivel = número en `hld_*` / `hlg_*`). */
const CFG_MODALIDAD_JORNADA = [
  ["CFG_MOD_01_COMPLETA", "Jornada Completa"],
  ["CFG_MOD_02_REDUCIDA", "Jornada Reducida"],
  ["CFG_MOD_03_FRANCO", "Franco - Descanso"],
  ["CFG_MOD_04_GUARDIA_24", "Guardia 24hs"],
];

const CFG_ESTADO_ASIGNACION_LABORAL = [
  ["CFG_EST_LAB_01_ACTIVA", "Activa"],
  ["CFG_EST_LAB_02_SUSPENDIDA", "Suspendida"],
  ["CFG_EST_LAB_03_FINALIZADA", "Finalizada"],
];

const CFG_CAUSAL_FIN_ASIGNACION_LABORAL = [
  ["CFG_CAU_FIN_01_RENUNCIA", "Renuncia"],
  ["CFG_CAU_FIN_02_JUBILACION", "Jubilación"],
  ["CFG_CAU_FIN_03_SUPLENCIA", "Fin de Suplencia / Reemplazo"],
  ["CFG_CAU_FIN_04_FALLECIMIENTO", "Fallecimiento"],
];

const CFG_TIPO_ACTO_DESIGNACION = [
  ["CFG_ACT_01_DECRETO", "Decreto Provincial"],
  ["CFG_ACT_02_RESOLUCION", "Resolución Ministerial"],
  ["CFG_ACT_03_DISPOSICION", "Disposición Interna (Hospital)"],
  ["CFG_ACT_04_CONTRATO", "Contrato / Locación de Servicios"],
];

const CFG_REGIMEN_HORARIO = [
  ["CFG_REG_HOR_01_DIURNO", "Diurno"],
  ["CFG_REG_HOR_02_NOCTURNO", "Nocturno"],
  ["CFG_REG_HOR_03_MIXTO", "Mixto"],
  ["CFG_REG_HOR_04_GUARDIAS", "Guardias"],
];

const CFG_CENTRO_COSTO = [
  ["CFG_CEN_COST_01_ASISTENCIAL", "Asistencial"],
  ["CFG_CEN_COST_02_ADMINISTRATIVO", "Administrativo"],
  ["CFG_CEN_COST_03_GUARDIA", "Guardia"],
  ["CFG_CEN_COST_04_APOYO_DIAGNOSTICO", "Apoyo diagnóstico"],
];

async function main() {
  const app = getApp();
  const projectId = app.options?.projectId || "desconocido";
  const dbLabel = nonDefaultDatabaseId
    ? `named=${nonDefaultDatabaseId}`
    : "default (getFirestore sin 2.º id)";
  console.log(`[seedConfiguracion] Inicio project=${projectId} database=${dbLabel}`);

  const batch = db.batch();

  for (const [id, nombre] of CFG_ESTADO_CIVIL) {
    const ref = db.collection("cfg_estado_civil").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_SEXO_GENERO) {
    const ref = db.collection("cfg_sexo_genero").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_TIPO_VINCULO_LABORAL) {
    const ref = db.collection("cfg_tipo_vinculo_laboral").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_ESCALAFON) {
    const ref = db.collection("cfg_escalafon").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_CARGO_FUNCIONAL) {
    const ref = db.collection("cfg_cargo_funcional").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre, orden] of CFG_DIA_SEMANA) {
    const ref = db.collection("cfg_dia_semana").doc(id);
    batch.set(ref, docDataDiaSemana(id, nombre, orden), { merge: true });
  }

  for (const [id, nombre] of CFG_APTITUD_PSICOFISICA) {
    const ref = db.collection("cfg_aptitud_psicofisica").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_AGRUPAMIENTO) {
    const ref = db.collection("cfg_agrupamiento").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_EFECTORES) {
    const ref = db.collection("cfg_efectores").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_CATEGORIAS) {
    const ref = db.collection("cfg_categorias").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_NACIONALIDAD) {
    const ref = db.collection("cfg_nacionalidad").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_PROVINCIA) {
    const ref = db.collection("cfg_provincia").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre, provinciaId] of CFG_LOCALIDAD) {
    const ref = db.collection("cfg_localidad").doc(id);
    batch.set(
      ref,
      docDataLocalidad(id, nombre, provinciaId),
      { merge: true },
    );
  }

  for (const [id, nombre] of CFG_NIVEL_ESTUDIOS) {
    const ref = db.collection("cfg_nivel_estudios").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_PARENTESCO) {
    const ref = db.collection("cfg_parentesco").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_MODALIDAD_JORNADA) {
    const ref = db.collection("cfg_modalidad_jornada").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_ESTADO_ASIGNACION_LABORAL) {
    const ref = db.collection("cfg_estado_asignacion_laboral").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_CAUSAL_FIN_ASIGNACION_LABORAL) {
    const ref = db.collection("cfg_causal_fin_asignacion_laboral").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  for (const [id, nombre] of CFG_TIPO_ACTO_DESIGNACION) {
    const ref = db.collection("cfg_tipo_acto_designacion").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }
  for (const [id, nombre] of CFG_REGIMEN_HORARIO) {
    const ref = db.collection("cfg_regimen_horario").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }
  for (const [id, nombre] of CFG_CENTRO_COSTO) {
    const ref = db.collection("cfg_centro_costo").doc(id);
    batch.set(ref, docData(id, nombre), { merge: true });
  }

  await batch.commit();

  const total =
    CFG_ESTADO_CIVIL.length +
    CFG_SEXO_GENERO.length +
    CFG_TIPO_VINCULO_LABORAL.length +
    CFG_ESCALAFON.length +
    CFG_CARGO_FUNCIONAL.length +
    CFG_DIA_SEMANA.length +
    CFG_APTITUD_PSICOFISICA.length +
    CFG_AGRUPAMIENTO.length +
    CFG_EFECTORES.length +
    CFG_CATEGORIAS.length +
    CFG_NACIONALIDAD.length +
    CFG_PROVINCIA.length +
    CFG_LOCALIDAD.length +
    CFG_NIVEL_ESTUDIOS.length +
    CFG_PARENTESCO.length +
    CFG_MODALIDAD_JORNADA.length +
    CFG_ESTADO_ASIGNACION_LABORAL.length +
    CFG_CAUSAL_FIN_ASIGNACION_LABORAL.length +
    CFG_TIPO_ACTO_DESIGNACION.length +
    CFG_REGIMEN_HORARIO.length +
    CFG_CENTRO_COSTO.length;

  const out = {
    ok: true,
    projectId,
    database: nonDefaultDatabaseId || "(default)",
    collections: {
      cfg_estado_civil: CFG_ESTADO_CIVIL.map(([id]) => id),
      cfg_sexo_genero: CFG_SEXO_GENERO.map(([id]) => id),
      cfg_tipo_vinculo_laboral: CFG_TIPO_VINCULO_LABORAL.map(([id]) => id),
      cfg_escalafon: CFG_ESCALAFON.map(([id]) => id),
      cfg_cargo_funcional: CFG_CARGO_FUNCIONAL.map(([id]) => id),
      cfg_dia_semana: CFG_DIA_SEMANA.map(([id]) => id),
      cfg_aptitud_psicofisica: CFG_APTITUD_PSICOFISICA.map(([id]) => id),
      cfg_agrupamiento: CFG_AGRUPAMIENTO.map(([id]) => id),
      cfg_efectores: CFG_EFECTORES.map(([id]) => id),
      cfg_categorias: CFG_CATEGORIAS.map(([id]) => id),
      cfg_nacionalidad: CFG_NACIONALIDAD.map(([id]) => id),
      cfg_provincia: CFG_PROVINCIA.map(([id]) => id),
      cfg_localidad: CFG_LOCALIDAD.map(([id]) => id),
      cfg_nivel_estudios: CFG_NIVEL_ESTUDIOS.map(([id]) => id),
      cfg_parentesco: CFG_PARENTESCO.map(([id]) => id),
      cfg_modalidad_jornada: CFG_MODALIDAD_JORNADA.map(([id]) => id),
      cfg_estado_asignacion_laboral: CFG_ESTADO_ASIGNACION_LABORAL.map(([id]) => id),
      cfg_causal_fin_asignacion_laboral: CFG_CAUSAL_FIN_ASIGNACION_LABORAL.map(([id]) => id),
      cfg_tipo_acto_designacion: CFG_TIPO_ACTO_DESIGNACION.map(([id]) => id),
      cfg_regimen_horario: CFG_REGIMEN_HORARIO.map(([id]) => id),
      cfg_centro_costo: CFG_CENTRO_COSTO.map(([id]) => id),
    },
    documentosEscritos: total,
  };

  console.log(
    "[seedConfiguracion] Batch completado correctamente —",
    JSON.stringify(out, null, 2),
  );
  console.log(`[seedConfiguracion] Fin: ${total} documentos.`);
}

try {
  await main();
} catch (e) {
  console.error("[seedConfiguracion] Error al ejecutar el batch:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
}
