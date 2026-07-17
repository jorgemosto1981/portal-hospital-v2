/**
 * Dev-only: alta de LOKITO (DNI 1234567) como subordinado del jefe demo (28914247)
 * en el mismo GDT Etapa 1, con jerarquía HLg válida (evita solicitud huérfana).
 *
 * Uso (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\DATOS\portal-hospital-v2-dev-firebase-adminsdk-fbsvc-cabdc46f65.json"
 *   $env:FIREBASE_V2_PROJECT_ID="portal-hospital-v2-dev"
 *   $env:ALLOW_FIRESTORE_SEED_V2="true"
 *   node scripts/seed-v2/bootstrap-dev-lokito-subordinado.mjs
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { ulid } = require(join(repoRoot, "web/node_modules/ulid"));
const { computeLaborProfileForPersona } = require(join(
  repoRoot,
  "functions/modules/shared/laborProfile.js",
));
const { applyLaborAwareSessionClaims } = require(join(
  repoRoot,
  "functions/modules/shared/authClaims.js",
));

if (process.env.ALLOW_FIRESTORE_SEED_V2 !== "true") {
  console.error("Definí ALLOW_FIRESTORE_SEED_V2=true");
  process.exit(1);
}

const credPath = String(process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
const sa = JSON.parse(readFileSync(credPath, "utf8"));
const projectId = "portal-hospital-v2-dev";
if (sa.project_id !== projectId) {
  console.error(`[lokito] Abort: SA project=${sa.project_id} (esperado ${projectId})`);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(sa), projectId });
}
const db = getFirestore();
const auth = getAuth();

const JEFE_DNI = "28914247";
const SUB_DNI = "1234567";
const SUB_PIN = "123456";
const SUB_EMAIL = `portal-dev-${SUB_DNI}@example.com`;
const SUB_NOMBRE = "Loko";
const SUB_APELLIDO = "Lokito";
const NIVEL_JEFE = 50;
const NIVEL_SUB = 1;

const jefeSnap = await db.collection("personas").where("dni", "==", JEFE_DNI).limit(1).get();
if (jefeSnap.empty) {
  console.error(`[lokito] No está el jefe DNI ${JEFE_DNI} en-dev. Corré bootstrap-dev-agente primero.`);
  process.exit(1);
}
const jefePerId = jefeSnap.docs[0].id;
const jefeHlgSnap = await db
  .collection("historial_laboral_grupos")
  .where("persona_id", "==", jefePerId)
  .where("activo", "==", true)
  .limit(5)
  .get();
if (jefeHlgSnap.empty) {
  console.error("[lokito] Jefe sin HLg activo");
  process.exit(1);
}
const jefeHlg = jefeHlgSnap.docs[0];
const gdtId = String(jefeHlg.data().grupo_de_trabajo_id || "").trim();
if (!/^gdt_/i.test(gdtId)) {
  console.error("[lokito] GDT inválido en HLg jefe");
  process.exit(1);
}

console.log(`[lokito] project=${projectId}`);
console.log(`[lokito] GDT ${gdtId}`);
console.log(`[lokito] jefe ${jefePerId} DNI ${JEFE_DNI} → nivel ${NIVEL_JEFE}`);

await jefeHlg.ref.set(
  {
    nivel_jerarquico: NIVEL_JEFE,
    actualizado_en: FieldValue.serverTimestamp(),
    metadata: { seed_bootstrap_lokito_sub: true },
  },
  { merge: true },
);

const jefeCuenta = await db
  .collection("usuarios_cuenta")
  .where("persona_id", "==", jefePerId)
  .limit(1)
  .get();
const jefeUsr = jefeCuenta.docs[0];
const jefeUid = String(jefeUsr?.data()?.auth_uid || "").trim();

const jefeHlcJefe = await db
  .collection("historial_laboral_cargos")
  .where("persona_id", "==", jefePerId)
  .where("rol_id", "==", "CFG_JEFE")
  .limit(1)
  .get();

if (jefeHlcJefe.empty) {
  const hlcId = `hlc_${ulid()}`;
  const hldId = `hld_${ulid()}`;
  const hlgId = `hlg_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  await db.collection("historial_laboral_cargos").doc(hlcId).set({
    persona_id: jefePerId,
    rol_id: "CFG_JEFE",
    activo: true,
    fecha_desde: "2020-01-01",
    fecha_hasta: null,
    grupo_de_trabajo_id: gdtId,
    schema_version: 1,
    creado_en: ts,
    actualizado_en: ts,
    metadata: { seed_bootstrap_lokito_sub: true },
  });
  await db.collection("historial_laboral_datos").doc(hldId).set({
    persona_id: jefePerId,
    cargo_id: hlcId,
    activo: true,
    fecha_inicio: "2020-01-01",
    fecha_fin: null,
    schema_version: 1,
    creado_en: ts,
    actualizado_en: ts,
  });
  await db.collection("historial_laboral_grupos").doc(hlgId).set({
    persona_id: jefePerId,
    dato_laboral_id: hldId,
    grupo_de_trabajo_id: gdtId,
    nivel_jerarquico: NIVEL_JEFE,
    activo: true,
    fecha_inicio: "2020-01-01",
    fecha_fin: null,
    schema_version: 1,
    creado_en: ts,
    actualizado_en: ts,
    metadata: { seed_bootstrap_lokito_sub: true },
  });
  console.log(`[lokito] Alta cadena CFG_JEFE para jefe (${hlcId})`);
} else {
  console.log(`[lokito] Jefe ya tiene CFG_JEFE (${jefeHlcJefe.docs[0].id})`);
}

if (jefeUid && jefeUsr) {
  await applyLaborAwareSessionClaims(jefeUid, jefePerId, jefeUsr.id);
  const perfilJefe = await computeLaborProfileForPersona(jefePerId);
  console.log(`[lokito] claims jefe roles=${JSON.stringify(perfilJefe.roles_hlc_vigentes)}`);
}

let subSnap = await db.collection("personas").where("dni", "==", SUB_DNI).limit(1).get();
let subPerId;
let subUsrId;
let subUid;

if (!subSnap.empty) {
  subPerId = subSnap.docs[0].id;
  console.log(`[lokito] Persona subordinado ya existe ${subPerId}`);
} else {
  subPerId = `per_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  await db.collection("personas").doc(subPerId).set({
    persona_id: subPerId,
    dni: SUB_DNI,
    nombre: SUB_NOMBRE,
    apellido: SUB_APELLIDO,
    estado: "ACTIVO",
    activo: true,
    schema_version: 1,
    estado_perfil_datos_id: "cfg_epd_borr",
    perfil_completitud_version: 0,
    metadata: { seed_bootstrap_lokito_sub: true },
    creado_en: ts,
    actualizado_en: ts,
  });
  console.log(`[lokito] Persona creada ${subPerId}`);
}

try {
  const existing = await auth.getUserByEmail(SUB_EMAIL);
  subUid = existing.uid;
  await auth.updateUser(subUid, { password: SUB_PIN });
  console.log(`[lokito] Auth existente ${SUB_EMAIL}, PIN actualizado`);
} catch (e) {
  if (e?.code !== "auth/user-not-found") throw e;
  const rec = await auth.createUser({
    email: SUB_EMAIL,
    password: SUB_PIN,
    emailVerified: false,
  });
  subUid = rec.uid;
  console.log(`[lokito] Auth creado ${SUB_EMAIL} uid=${subUid}`);
}

const cuentaSnap = await db
  .collection("usuarios_cuenta")
  .where("persona_id", "==", subPerId)
  .limit(1)
  .get();
if (!cuentaSnap.empty) {
  subUsrId = cuentaSnap.docs[0].id;
  await cuentaSnap.docs[0].ref.set(
    {
      auth_uid: subUid,
      username: SUB_EMAIL,
      activo: true,
      estado_acceso: "cfg_eca_activo",
      role_ids: ["CFG_USUARIO"],
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
} else {
  subUsrId = `usr_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  await db.collection("usuarios_cuenta").doc(subUsrId).set({
    persona_id: subPerId,
    auth_uid: subUid,
    auth_proveedor_id: "password",
    username: SUB_EMAIL,
    activo: true,
    estado_acceso: "cfg_eca_activo",
    role_ids: ["CFG_USUARIO"],
    creado_en: ts,
    actualizado_en: ts,
  });
}

const hlcExist = await db
  .collection("historial_laboral_cargos")
  .where("persona_id", "==", subPerId)
  .where("rol_id", "==", "CFG_USUARIO")
  .limit(1)
  .get();

let hlcId;
let hldId;
if (!hlcExist.empty) {
  hlcId = hlcExist.docs[0].id;
  await hlcExist.docs[0].ref.set(
    {
      activo: true,
      fecha_hasta: null,
      grupo_de_trabajo_id: gdtId,
      actualizado_en: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const hldExist = await db
    .collection("historial_laboral_datos")
    .where("persona_id", "==", subPerId)
    .where("cargo_id", "==", hlcId)
    .limit(1)
    .get();
  if (hldExist.empty) {
    hldId = `hld_${ulid()}`;
    await db.collection("historial_laboral_datos").doc(hldId).set({
      persona_id: subPerId,
      cargo_id: hlcId,
      activo: true,
      fecha_inicio: "2020-01-01",
      fecha_fin: null,
      schema_version: 1,
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
    });
  } else {
    hldId = hldExist.docs[0].id;
    await hldExist.docs[0].ref.set(
      { activo: true, fecha_fin: null, actualizado_en: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
} else {
  hlcId = `hlc_${ulid()}`;
  hldId = `hld_${ulid()}`;
  const ts = FieldValue.serverTimestamp();
  await db.collection("historial_laboral_cargos").doc(hlcId).set({
    persona_id: subPerId,
    rol_id: "CFG_USUARIO",
    activo: true,
    fecha_desde: "2020-01-01",
    fecha_hasta: null,
    grupo_de_trabajo_id: gdtId,
    schema_version: 1,
    creado_en: ts,
    actualizado_en: ts,
  });
  await db.collection("historial_laboral_datos").doc(hldId).set({
    persona_id: subPerId,
    cargo_id: hlcId,
    activo: true,
    fecha_inicio: "2020-01-01",
    fecha_fin: null,
    schema_version: 1,
    creado_en: ts,
    actualizado_en: ts,
  });
}

const hlgSub = await db
  .collection("historial_laboral_grupos")
  .where("persona_id", "==", subPerId)
  .where("grupo_de_trabajo_id", "==", gdtId)
  .limit(1)
  .get();
if (!hlgSub.empty) {
  await hlgSub.docs[0].ref.set(
    {
      activo: true,
      nivel_jerarquico: NIVEL_SUB,
      fecha_fin: null,
      dato_laboral_id: hldId,
      actualizado_en: FieldValue.serverTimestamp(),
      metadata: { seed_bootstrap_lokito_sub: true },
    },
    { merge: true },
  );
} else {
  const hlgId = `hlg_${ulid()}`;
  await db.collection("historial_laboral_grupos").doc(hlgId).set({
    persona_id: subPerId,
    dato_laboral_id: hldId,
    grupo_de_trabajo_id: gdtId,
    nivel_jerarquico: NIVEL_SUB,
    activo: true,
    fecha_inicio: "2020-01-01",
    fecha_fin: null,
    schema_version: 1,
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
    metadata: { seed_bootstrap_lokito_sub: true },
  });
}

await db.collection("cfg_etapa1").doc("runtime").set(
  {
    gdt_ids_etapa1: FieldValue.arrayUnion(gdtId),
    etapa1_habilitada: true,
    forzar_catalogo_etapa1: true,
    actualizado_en: new Date().toISOString(),
  },
  { merge: true },
);

await applyLaborAwareSessionClaims(subUid, subPerId, subUsrId);
const perfilSub = await computeLaborProfileForPersona(subPerId);

console.log("");
console.log("[lokito] OK — cadena para smoke modo_resolucion_jefe");
console.log(`  Agente (subordinado): DNI ${SUB_DNI} / PIN ${SUB_PIN} → ${subPerId}`);
console.log(`  Jefe:                 DNI ${JEFE_DNI} / PIN 123456 → ${jefePerId} (nivel ${NIVEL_JEFE} + CFG_JEFE)`);
console.log(`  GDT Etapa 1:          ${gdtId}`);
console.log(`  claims agente: ${JSON.stringify(perfilSub.roles_hlc_vigentes)}`);
console.log("");
console.log("Importante: usá npm run dev:web:dev (proyecto portal-hospital-v2-dev).");
console.log("Re-login en ambos usuarios para refrescar claims.");
