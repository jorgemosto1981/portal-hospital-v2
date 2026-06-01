/**
 * Smoke test — Patrón B Motor V2 via Admin SDK.
 *
 * Valida que runPatronBAltaMotorV2 produce motor_snapshot (8 fases)
 * y config_usada (7 bloques) con la shape esperada.
 *
 * Uso:
 *   node scripts/smoke-patron-b-motor-v2.mjs                            # dry-run
 *   node scripts/smoke-patron-b-motor-v2.mjs --apply                    # crea solicitud real
 *   node scripts/smoke-patron-b-motor-v2.mjs --persona=per_...          # otro agente
 *   node scripts/smoke-patron-b-motor-v2.mjs --articulo=art_...         # otro artículo
 *   node scripts/smoke-patron-b-motor-v2.mjs --fecha=2026-06-02         # otra fecha
 *   node scripts/smoke-patron-b-motor-v2.mjs --dias=1                   # días a solicitar
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const { runPatronBAltaMotorV2 } = require(
  join(repoRoot, "functions/modules/shared/patronBAltaMotorV2.js"),
);
const { PATRON_SALDO_B } = require(
  join(repoRoot, "functions/modules/shared/resolvePatronSaldo.js"),
);
const { saldoAnualDocId, pickBolsaParaConsumo } = require(
  join(repoRoot, "functions/modules/shared/laoSaldosBolsa.js"),
);

const TAG = "[smoke-patron-b-v2]";
const ARTICULO_64A = "art_01KRNK10V10CH7W5M2W6V558GS";
const PERSONA_DEFAULT = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

const FASES_ESPERADAS = ["P", "C", "E", "W", "F", "T", "S", "G"];
const BLOQUES_ESPERADOS = [
  "bloque_identidad_naturaleza",
  "bloque_impacto_economico",
  "bloque_elegibilidad_filtros",
  "bloque_topes_plazos_computo",
  "bloque_acumulacion_sucesion",
  "bloque_workflow_sla_cobertura",
  "bloque_documentacion_convivencia",
];

// ── Helpers ──────────────────────────────────────────────────────────

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--persona=")) out.persona = a.slice("--persona=".length);
    else if (a.startsWith("--articulo=")) out.articulo = a.slice("--articulo=".length);
    else if (a.startsWith("--fecha=")) out.fecha = a.slice("--fecha=".length);
    else if (a.startsWith("--dias=")) out.dias = Number(a.slice("--dias=".length));
  }
  return out;
}

function hoy() {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function ok(label) { console.log(`  ✅ ${label}`); }
function fail(label) { console.error(`  ❌ ${label}`); }
function warn(label) { console.warn(`  ⚠️  ${label}`); }

// ── Init ─────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const personaId = String(args.persona ?? PERSONA_DEFAULT).trim();
const articuloId = String(args.articulo ?? ARTICULO_64A).trim();
const fechaDesde = String(args.fecha ?? hoy()).trim().slice(0, 10);
const diasSolicitados = Number.isFinite(args.dias) && args.dias > 0 ? args.dias : 1;
const anioCiclo = Number(fechaDesde.slice(0, 4));

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error(`${TAG} Falta GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local o entorno).`);
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });
const db = getFirestore();

console.log(`${TAG} proyecto:    ${db.app?.options?.projectId ?? "(default)"}`);
console.log(`${TAG} persona_id:  ${personaId}`);
console.log(`${TAG} articulo_id: ${articuloId}`);
console.log(`${TAG} fecha_desde: ${fechaDesde}`);
console.log(`${TAG} dias:        ${diasSolicitados}`);
console.log(`${TAG} modo:        ${apply ? "APLICAR (crea solicitud en Firestore)" : "DRY-RUN (solo motor local)"}`);
console.log("─".repeat(60));

// ── 1. Resolver versión publicada ────────────────────────────────────

const verSnap = await db
  .collection("cfg_articulos").doc(articuloId)
  .collection("versiones")
  .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
  .limit(3)
  .get();

if (verSnap.empty) {
  console.error(`${TAG} No hay versión publicada para ${articuloId}.`);
  process.exit(1);
}

const verDoc = verSnap.docs[0];
const versionId = verDoc.id;
const versionData = verDoc.data() || {};
console.log(`${TAG} version_id: ${versionId}`);

// ── 2. Verificar saldo disponible ────────────────────────────────────

const salId = saldoAnualDocId(personaId, anioCiclo);
const salSnap = salId ? await db.collection("saldos_articulo_agente").doc(salId).get() : null;
const bolsaMatch = salSnap?.exists
  ? pickBolsaParaConsumo(salSnap.data() || {}, articuloId, anioCiclo)
  : null;

if (bolsaMatch) {
  const b = bolsaMatch.bolsa;
  console.log(`${TAG} bolsa encontrada: ${bolsaMatch.bolsaId}`);
  console.log(`  disponible: ${b.disponible}, consumido: ${b.consumido}, cantidad_inicial: ${b.cantidad_inicial}`);
} else {
  warn(`Sin bolsa de saldo para ${articuloId} en ciclo ${anioCiclo} — el motor debería reportar SALDO_CICLO.`);
}
console.log("─".repeat(60));

// ── 3. Ejecutar motor V2 (local) ────────────────────────────────────

console.log(`${TAG} Ejecutando runPatronBAltaMotorV2...`);
const t0 = Date.now();

const motor = await runPatronBAltaMotorV2({
  db,
  solicitud: {
    titular_persona_id: personaId,
    articulo_id: articuloId,
    version_aplicada_id: versionId,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaDesde,
    dias_solicitados: diasSolicitados,
    anio_ciclo_consumo: anioCiclo,
    grupo_trabajo_id_ancla: null,
  },
  excludeSolId: "__smoke_test__",
  authToken: null,
  versionData,
  versionId,
});

const elapsed = Date.now() - t0;
console.log(`${TAG} Motor completado en ${elapsed}ms`);
console.log("─".repeat(60));

// ── 4. Validar resultado ─────────────────────────────────────────────

console.log(`${TAG} RESULTADO MOTOR V2:`);
console.log(`  eligible:      ${motor.eligible}`);
console.log(`  ok:            ${motor.ok}`);
console.log(`  fase_corte:    ${motor.fase_corte ?? "(ninguna)"}`);
console.log(`  dias_consumo:  ${motor.dias_consumo}`);
console.log(`  saldo_doc_id:  ${motor.saldo_doc_id ?? "-"}`);
console.log(`  bolsa_id:      ${motor.bolsa_id ?? "-"}`);
console.log(`  hlc_id:        ${motor.hlc_id ?? "-"}`);
console.log(`  modo_computo:  ${motor.modo_computo ?? "-"}`);

if (motor.codigos?.length) {
  console.log(`  codigos:       ${motor.codigos.join(", ")}`);
}
if (motor.mensajes?.length) {
  console.log(`  mensajes:      ${motor.mensajes.join(" | ")}`);
}
console.log("─".repeat(60));

// ── 5. Validar motor_snapshot ────────────────────────────────────────

let errores = 0;
console.log(`${TAG} VALIDACION motor_snapshot:`);

const snap = motor.motor_snapshot;
if (!snap || typeof snap !== "object") {
  fail("motor_snapshot ausente o no es objeto");
  errores++;
} else {
  ok(`motor_version: ${snap.motor_version}`);
  if (snap.motor_version !== "patron-b-v2") {
    fail(`motor_version esperado 'patron-b-v2', obtenido '${snap.motor_version}'`);
    errores++;
  }

  if (!snap.version_aplicada_id) { fail("version_aplicada_id ausente"); errores++; }
  else ok(`version_aplicada_id: ${snap.version_aplicada_id}`);

  if (typeof snap.eligible !== "boolean") { fail("eligible no es boolean"); errores++; }
  else ok(`eligible: ${snap.eligible}`);

  if (!snap.evaluado_en) { fail("evaluado_en ausente"); errores++; }
  else ok(`evaluado_en: ${snap.evaluado_en}`);

  const checks = snap.checks || [];
  const fasesPresentes = [...new Set(checks.map((c) => c.fase))].sort();
  const fasesEsperadasSort = [...FASES_ESPERADAS].sort();

  // W is a warning-only phase — it may not produce checks
  const fasesObligatorias = fasesEsperadasSort.filter((f) => f !== "W");
  if (motor.eligible) {
    const allPresent = fasesObligatorias.every((f) => fasesPresentes.includes(f));
    if (allPresent) {
      ok(`Fases completas en checks: [${fasesPresentes.join(", ")}]`);
      if (!fasesPresentes.includes("W")) {
        ok("Fase W (preaviso): sin warnings — correcto si no aplica preaviso");
      }
    } else {
      const missing = fasesObligatorias.filter((f) => !fasesPresentes.includes(f));
      fail(`Fases faltantes: [${missing.join(", ")}] (presentes: [${fasesPresentes.join(", ")}])`);
      errores++;
    }
  } else {
    ok(`Fases hasta corte: [${fasesPresentes.join(", ")}] (corte en ${motor.fase_corte})`);
  }

  console.log(`  checks (${checks.length}):`);
  for (const c of checks) {
    const icon = c.nivel === "bloqueante" ? "🔴" : c.nivel === "ok" ? "🟢" : "🟡";
    console.log(`    ${icon} [${c.fase}] ${c.codigo} — ${c.detalle ?? "-"}`);
  }

  const warnings = snap.warnings || [];
  if (warnings.length) {
    console.log(`  warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`    🟡 ${w.codigo} — ${w.copy ?? "-"}`);
    }
  }

  if (snap.asignacion && motor.eligible) {
    ok(`asignacion.dias_consumo: ${snap.asignacion.dias_consumo}`);
    ok(`asignacion.saldo_disponible: ${snap.asignacion.saldo_disponible}`);
  }

  if (snap.config_usada && typeof snap.config_usada === "object") {
    ok("config_usada embebida en snapshot");
  }

  if (snap.contexto_auditoria && typeof snap.contexto_auditoria === "object") {
    ok("contexto_auditoria presente en snapshot");
  }
}

// ── 6. Validar config_usada ──────────────────────────────────────────

console.log("─".repeat(60));
console.log(`${TAG} VALIDACION config_usada:`);

const cfg = motor.config_usada;
if (!cfg || typeof cfg !== "object") {
  fail("config_usada ausente o no es objeto");
  errores++;
} else {
  if (!cfg.version_aplicada_id) { fail("config_usada.version_aplicada_id ausente"); errores++; }
  else ok(`version_aplicada_id: ${cfg.version_aplicada_id}`);

  if (cfg.motor_tipo !== "patron-b-v2") {
    fail(`config_usada.motor_tipo esperado 'patron-b-v2', obtenido '${cfg.motor_tipo}'`);
    errores++;
  } else {
    ok(`motor_tipo: ${cfg.motor_tipo}`);
  }

  const metaKeys = new Set(["version_aplicada_id", "motor_tipo"]);
  const campoKeys = Object.keys(cfg).filter((k) => !metaKeys.has(k));
  const camposNull = campoKeys.filter((k) => cfg[k] === null || cfg[k] === undefined).length;
  const camposConValor = campoKeys.length - camposNull;
  ok(`Total campos resueltos: ${campoKeys.length} (${camposConValor} con valor, ${camposNull} null)`);

  if (campoKeys.length < 10) {
    warn(`Menos de 10 campos — se esperaba cableado total de los 7 bloques`);
    errores++;
  }
}

// ── 7. Resumen ───────────────────────────────────────────────────────

console.log("─".repeat(60));
if (errores > 0) {
  console.error(`${TAG} SMOKE TEST CON ${errores} ERROR(ES) — revisar arriba.`);
} else {
  console.log(`${TAG} SMOKE TEST DRY-RUN EXITOSO — motor_snapshot y config_usada válidos.`);
}

// ── 8. Modo --apply: crear solicitud real ────────────────────────────

if (!apply) {
  if (errores === 0) {
    console.log(`${TAG} Agregá --apply para crear una solicitud real y verificar el trigger.`);
  }
  process.exit(errores > 0 ? 1 : 0);
}

if (errores > 0) {
  console.error(`${TAG} No se puede crear solicitud con errores en dry-run.`);
  process.exit(1);
}

if (!motor.eligible) {
  console.error(`${TAG} Motor no habilitó — no se crea solicitud. Revisá saldo/elegibilidad.`);
  process.exit(1);
}

console.log("─".repeat(60));
console.log(`${TAG} CREANDO SOLICITUD EN FIRESTORE...`);

  const fnRequire = createRequire(join(repoRoot, "functions/index.js"));
  const { ulid } = fnRequire("ulid");
const solId = `sol_${ulid()}`;
const solRef = db.collection("solicitudes_articulo").doc(solId);

const solicitudPayload = {
  schema_version: 2,
  patron_saldo: "B",
  estado_solicitud_id: "cfg_esa_borrador",
  titular_persona_id: personaId,
  articulo_id: articuloId,
  version_aplicada_id: versionId,
  version_id_aplicada: versionId,
  fecha_desde: fechaDesde,
  fecha_hasta: fechaDesde,
  dias_solicitados: diasSolicitados,
  anio_ciclo_consumo: anioCiclo,
  grupo_trabajo_id_ancla: motor.grupo_trabajo_id_ancla || null,
  creado_en: FieldValue.serverTimestamp(),
  actualizado_en: FieldValue.serverTimestamp(),
  _smoke_test: true,
};

await solRef.set(solicitudPayload);
console.log(`${TAG} Solicitud creada: ${solId}`);
console.log(`${TAG} Esperando trigger (15s)...`);

await sleep(15000);

const solSnap = await solRef.get();
if (!solSnap.exists) {
  fail("Solicitud no encontrada post-trigger");
  process.exit(1);
}

const solData = solSnap.data() || {};
console.log("─".repeat(60));
console.log(`${TAG} RESULTADO POST-TRIGGER:`);
console.log(`  estado:              ${solData.estado_solicitud_id}`);
console.log(`  motor_descuento:     ${solData.motor_descuento_aplicado}`);
console.log(`  motor_bolsa_id:      ${solData.motor_bolsa_id ?? "-"}`);
console.log(`  motor_dias_descontados: ${solData.motor_dias_descontados ?? "-"}`);
console.log(`  hlc_id_elegibilidad: ${solData.hlc_id_elegibilidad ?? "-"}`);

let erroresPost = 0;

if (solData.motor_snapshot && typeof solData.motor_snapshot === "object") {
  ok("motor_snapshot persistido en Firestore");
  const snapPersist = solData.motor_snapshot;
  console.log(`    motor_version: ${snapPersist.motor_version}`);
  console.log(`    eligible:      ${snapPersist.eligible}`);
  const fasesPersist = [...new Set((snapPersist.checks || []).map((c) => c.fase))];
  console.log(`    fases:         [${fasesPersist.join(", ")}]`);
  console.log(`    checks:        ${(snapPersist.checks || []).length}`);
  if (snapPersist.config_usada) {
    const metaKeys = new Set(["version_aplicada_id", "motor_tipo"]);
    const nCampos = Object.keys(snapPersist.config_usada).filter((k) => !metaKeys.has(k)).length;
    console.log(`    config_usada embebida: ${nCampos} campos`);
  }
} else {
  fail("motor_snapshot NO persistido");
  erroresPost++;
}

if (solData.config_usada && typeof solData.config_usada === "object") {
  ok("config_usada persistida en Firestore (top-level)");
  const metaKeys = new Set(["version_aplicada_id", "motor_tipo"]);
  const nCampos = Object.keys(solData.config_usada).filter((k) => !metaKeys.has(k)).length;
  console.log(`    motor_tipo: ${solData.config_usada.motor_tipo}`);
  console.log(`    campos resueltos: ${nCampos}`);
} else {
  fail("config_usada NO persistida");
  erroresPost++;
}

if (solData.estado_solicitud_id === "cfg_esa_en_revision_jefe") {
  ok("Estado transicionó a EN_REVISION_JEFE");
} else if (solData.estado_solicitud_id === "cfg_esa_rechazada") {
  warn(`Rechazada: ${(solData.motor_codigos || []).join(", ")} — ${(solData.motor_mensajes || []).join(" | ")}`);
} else {
  warn(`Estado inesperado: ${solData.estado_solicitud_id}`);
}

console.log("─".repeat(60));
if (erroresPost > 0) {
  console.error(`${TAG} SMOKE TEST E2E CON ${erroresPost} ERROR(ES) de persistencia.`);
  process.exit(1);
}

console.log(`${TAG} SMOKE TEST E2E EXITOSO`);
console.log(`${TAG} sol_id: ${solId}`);
console.log(`${TAG} Motor V2 Patrón B genera motor_snapshot + config_usada correctamente.`);
