/**
 * Pruebas mínimas de Security Rules V2 (Bloque 1: base común).
 * Ejecutar: npm run test:firestore:rules
 * Requiere: emulador (el script npm levanta uno con emulators:exec).
 *
 * @see docs/v2/DESARROLLO_ORDEN_LOGIN_DATOS_V2.md Fase 2.3
 * @see docs/v2/ACCESO_Y_RULES_FIRESTORE_V2.md
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const rulesPath = join(repoRoot, "firebase-v2", "firestore.rules");
const rules = readFileSync(rulesPath, "utf8");

const projectId = process.env.GCLOUD_PROJECT || "demo-hospital-v2";

let passed = 0;
let failed = 0;

function it(name, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`[OK] ${name}`);
      passed += 1;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e);
      failed += 1;
    }
  })();
}

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules },
});

await testEnv.clearFirestore();

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await db.doc("cfg_estado_cuenta_acceso/cfg_eca_pend_reg").set({ seed: true, codigo_interno: "PEND" });
  await db.doc("personas/per_mine").set({ dni: "30123456", nombre: "A", apellido: "B" });
  await db.doc("personas/per_stranger").set({ dni: "30999888", nombre: "X" });
  await db.doc("usuarios_cuenta/usr_foo").set({
    auth_uid: "uid_agente_1",
    persona_id: "per_mine",
  });
  await db.doc("eventos_ticket/evt_seeded").set({ tipo: "x" });
});

const un = testEnv.unauthenticatedContext();
const udb = un.firestore();
const withPid = testEnv.authenticatedContext("uid_agente_1", {
  email: "agent@hospital.test",
  persona_id: "per_mine",
});
const wdb = withPid.firestore();
const otherUid = testEnv.authenticatedContext("uid_intruso", {
  email: "x@x.test",
  persona_id: "per_mine",
});
const odb = otherUid.firestore();
const noClaims = testEnv.authenticatedContext("uid_solo", { email: "solo@hospital.test" });
const ndb = noClaims.firestore();

await it("anónimo: no lee cfg (request.auth == null)", async () => {
  await assertFails(udb.doc("cfg_estado_cuenta_acceso/cfg_eca_pend_reg").get());
});

await it("autenticado (sin claim persona_id): lee catálogo cfg", async () => {
  await assertSucceeds(ndb.doc("cfg_estado_cuenta_acceso/cfg_eca_pend_reg").get());
});

await it("mismo agente: lee su documento en personas", async () => {
  await assertSucceeds(wdb.doc("personas/per_mine").get());
});

await it("mismo agente: no lee persona ajena (otro per_*)", async () => {
  await assertFails(wdb.doc("personas/per_stranger").get());
});

await it("lee su usuarios_cuenta por auth_uid", async () => {
  await assertSucceeds(wdb.doc("usuarios_cuenta/usr_foo").get());
});

await it("otro uid: no lee fila ajenas en usuarios_cuenta", async () => {
  await assertFails(odb.doc("usuarios_cuenta/usr_foo").get());
});

await it("mismo agente: no escribe en personas (solo servidor/Admin)", async () => {
  await assertFails(
    wdb
      .doc("personas/per_mine")
      .set({ dni: "30123456", nombre: "A", apellido: "B", piso: "nope" }, { merge: true }),
  );
});

await it("colección no modelada: lectura denegada (deny by default)", async () => {
  await assertFails(wdb.doc("eventos_ticket/evt_seeded").get());
});

const PER_PILOTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const GDT_PILOTO = "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0";
const ART_PILOTO = "art_01KRNK10V10CH7W5M2W6V558GS";

const pilotoCtx = testEnv.authenticatedContext("uid_agente_1", {
  email: "agent@hospital.test",
  persona_id: PER_PILOTO,
});
const pdb = pilotoCtx.firestore();

function medAvisoPayloadBase() {
  return {
    schema_version: "SOL_MED_AVISO_V1",
    articulo_id: null,
    version_id_aplicada: null,
    titular_persona_id: PER_PILOTO,
    actor_alta_persona_id: PER_PILOTO,
    grupo_trabajo_id_ancla: GDT_PILOTO,
    patron_saldo: "MEDICO_AVISO",
    estado_solicitud_id: "cfg_esa_pendiente_clasificacion_medica",
    ingreso_medico: {
      modo: "caja_negra",
      tipo_ingreso_id: "cfg_tig_enfermedad_propia",
      es_licencia_incompleta: false,
      adjuntos: [{ storage_path: "avisos-med/2026/cert.pdf" }],
    },
    creado_en: new Date(),
    actualizado_en: new Date(),
  };
}

await it("SOL_MED_AVISO_V1: agente crea aviso con articulo_id null", async () => {
  await assertSucceeds(
    pdb.doc("solicitudes_articulo/sol_01KQN9WXFXF69Z9DCT5YNJ3TS0").set(medAvisoPayloadBase()),
  );
});

await it("SOL_MED_AVISO_V1: rechaza create si articulo_id art_*", async () => {
  const bad = { ...medAvisoPayloadBase(), articulo_id: ART_PILOTO };
  await assertFails(
    pdb.doc("solicitudes_articulo/sol_01KQN9WXFXF69Z9DCT5YNJ3TS1").set(bad),
  );
});

await it("SOL_MED_AVISO_V1: rechaza si titular distinto del claim", async () => {
  const bad = { ...medAvisoPayloadBase(), titular_persona_id: "per_01KQN9WXFXF69Z9DCT5YNJ3TG1" };
  await assertFails(
    pdb.doc("solicitudes_articulo/sol_01KQN9WXFXF69Z9DCT5YNJ3TS2").set(bad),
  );
});

function medAvisoIncompletoPayload() {
  const venc = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    ...medAvisoPayloadBase(),
    ingreso_medico: {
      modo: "caja_negra",
      tipo_ingreso_id: "cfg_tig_enfermedad_propia",
      es_licencia_incompleta: true,
      adjuntos: [],
      timestamp_aviso_incompleto: "2026-06-24T12:00:00.000Z",
    },
    vencimiento_plazo_certificado: venc,
  };
}

await it("SOL_MED_AVISO_V1: agente crea aviso incompleto sin adjuntos", async () => {
  await assertSucceeds(
    pdb.doc("solicitudes_articulo/sol_01KQN9WXFXF69Z9DCT5YNJ3TS3").set(medAvisoIncompletoPayload()),
  );
});

await it("SOL_MED_AVISO_V1: rechaza incompleto sin vencimiento_plazo_certificado", async () => {
  const bad = medAvisoIncompletoPayload();
  delete bad.vencimiento_plazo_certificado;
  await assertFails(
    pdb.doc("solicitudes_articulo/sol_01KQN9WXFXF69Z9DCT5YNJ3TS4").set(bad),
  );
});

await it("SOL_MED_AVISO_V1: rechaza update cliente (G1)", async () => {
  const id = "sol_01KQN9WXFXF69Z9DCT5YNJ3TS5";
  await assertSucceeds(pdb.doc(`solicitudes_articulo/${id}`).set(medAvisoIncompletoPayload()));
  await assertFails(
    pdb.doc(`solicitudes_articulo/${id}`).update({ "ingreso_medico.es_licencia_incompleta": false }),
  );
});

await testEnv.cleanup();

console.log(`\nResumen: ${passed} ok, ${failed} fallos (projectId=${projectId})`);
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
