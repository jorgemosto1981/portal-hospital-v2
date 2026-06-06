/**
 * Smoke test E2E — Patrón C Motor V2 en producción.
 *
 * 1. Busca persona por DNI
 * 2. Verifica versión publicada del artículo (patrón C)
 * 3. Crea/verifica bolsa global con saldo en horas
 * 4. Ejecuta motor V2 como dry-run (preview)
 *
 * Uso:
 *   node scripts/smoke-patron-c-motor-v2.mjs                         # dry-run
 *   node scripts/smoke-patron-c-motor-v2.mjs --apply                 # escribe bolsa + ejecuta motor
 *   node scripts/smoke-patron-c-motor-v2.mjs --dni=28914247          # otro agente
 *   node scripts/smoke-patron-c-motor-v2.mjs --horas=8               # horas a solicitar
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const {
  saldoGlobalDocId,
  buildBolsaKeyGlobal,
  pickBolsaParaConsumo,
} = require(join(repoRoot, "functions/modules/shared/laoSaldosBolsa.js"));
const { resolvePatronSaldo, PATRON_SALDO_C } = require(join(repoRoot, "functions/modules/shared/resolvePatronSaldo.js"));
const { resolvePatronCMotorConfig, buildPatronCConfigUsada } = require(join(repoRoot, "functions/modules/shared/patronCMotorConfigResolver.js"));
const { runPatronCAltaMotorV2, ANIO_ORIGEN_GLOBAL } = require(join(repoRoot, "functions/modules/shared/patronCAltaMotorV2.js"));

const TAG = "[smoke-patron-c]";

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        const v = t.split("=")[1]?.trim() ?? "";
        return v.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--dni=")) out.dni = a.slice("--dni=".length);
    else if (a.startsWith("--persona=")) out.persona = a.slice("--persona=".length);
    else if (a.startsWith("--articulo=")) out.articulo = a.slice("--articulo=".length);
    else if (a.startsWith("--version=")) out.version = a.slice("--version=".length);
    else if (a.startsWith("--horas=")) out.horas = Number(a.slice("--horas=".length));
    else if (a.startsWith("--saldo=")) out.saldo = Number(a.slice("--saldo=".length));
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const dniTarget = String(args.dni ?? "28914247").trim();
const articuloId = String(args.articulo ?? "art_01KRYEF39ZM0KB0F0Y4GPBH38F").trim();
const versionIdArg = String(args.version ?? "ver_01KRYEFZRQF0RKHJ5JTK6244G8").trim();
const horasSolicitar = Number(args.horas ?? 6);
const saldoInicial = Number(args.saldo ?? 100);

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error(`${TAG} Falta GOOGLE_APPLICATION_CREDENTIALS válido (.env.v2.local o entorno).`);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(gac) });
}
const db = getFirestore();

console.log(`${TAG} proyecto: ${db.app?.options?.projectId ?? "(default)"}`);
console.log(`${TAG} modo: ${apply ? "APLICAR (escribe Firestore)" : "DRY-RUN (solo simula)"}`);
console.log("---");

// ── 1. Buscar persona por DNI ──────────────────────────────────────────────
let personaId = String(args.persona ?? "").trim();
if (!personaId) {
  console.log(`${TAG} Buscando persona con DNI ${dniTarget}...`);
  const perSnap = await db.collection("personas")
    .where("dni", "==", dniTarget)
    .limit(1)
    .get();
  if (perSnap.empty) {
    const perSnap2 = await db.collection("personas")
      .where("dni", "==", Number(dniTarget))
      .limit(1)
      .get();
    if (perSnap2.empty) {
      console.error(`${TAG} ERROR: No se encontró persona con DNI ${dniTarget}.`);
      process.exit(1);
    }
    personaId = perSnap2.docs[0].id;
  } else {
    personaId = perSnap.docs[0].id;
  }
}
console.log(`${TAG} persona_id: ${personaId}`);

// ── 2. Verificar artículo y versión ────────────────────────────────────────
console.log(`${TAG} articulo_id: ${articuloId}`);
console.log(`${TAG} version_id: ${versionIdArg}`);

const versionSnap = await db
  .collection("cfg_articulos").doc(articuloId)
  .collection("versiones").doc(versionIdArg)
  .get();

if (!versionSnap.exists) {
  console.error(`${TAG} ERROR: Versión ${versionIdArg} no existe en artículo ${articuloId}.`);
  process.exit(1);
}

const versionData = versionSnap.data() || {};
const ident = versionData.bloque_identidad_naturaleza || {};
const topes = versionData.bloque_topes_plazos_computo || {};

const patron = resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);
console.log(`${TAG} patron resuelto: ${patron}`);

if (patron !== PATRON_SALDO_C) {
  console.error(`${TAG} ERROR: Versión no es Patrón C (obtenido: ${patron}).`);
  console.error(`${TAG}   reinicio_ciclo_id: ${topes.reinicio_ciclo_id}`);
  console.error(`${TAG}   origen_saldo_id: ${topes.origen_saldo_id}`);
  console.error(`${TAG}   es_lao_anual: ${ident.es_lao_anual}`);
  process.exit(1);
}

let cfg;
try {
  cfg = resolvePatronCMotorConfig(versionData);
  console.log(`${TAG} ConfigResolver OK — ${Object.keys(cfg).length} campos resueltos.`);
  console.log(`${TAG}   unidad_medida_id: ${cfg.unidad_medida_id}`);
  console.log(`${TAG}   tope_dias_por_evento: ${cfg.tope_dias_por_evento}`);
  console.log(`${TAG}   reinicio_ciclo_id: ${cfg.reinicio_ciclo_id}`);
  console.log(`${TAG}   origen_saldo_id: ${cfg.origen_saldo_id}`);
} catch (err) {
  console.error(`${TAG} ERROR ConfigResolver: ${err.message}`);
  process.exit(1);
}

const configUsada = buildPatronCConfigUsada(cfg, versionIdArg);
console.log(`${TAG} config_usada.motor_tipo: ${configUsada.motor_tipo}`);

// ── 3. Saldo global ───────────────────────────────────────────────────────
const salId = saldoGlobalDocId(personaId);
if (!salId) {
  console.error(`${TAG} ERROR: saldo global doc id inválido para ${personaId}.`);
  process.exit(1);
}
console.log(`${TAG} saldo_doc_id: ${salId}`);

const salRef = db.collection("saldos_articulo_agente").doc(salId);
const salSnap = await salRef.get();
const bolsaKey = buildBolsaKeyGlobal(articuloId);

if (salSnap.exists) {
  const match = pickBolsaParaConsumo(salSnap.data() || {}, articuloId, ANIO_ORIGEN_GLOBAL);
  if (match) {
    console.log(`${TAG} Bolsa global existente: ${bolsaKey}`);
    console.log(`${TAG}   disponible: ${match.bolsa.disponible}`);
    console.log(`${TAG}   consumido: ${match.bolsa.consumido}`);
  } else {
    console.log(`${TAG} Documento saldo existe pero sin bolsa para este artículo.`);
    if (apply) {
      console.log(`${TAG} Creando bolsa ${bolsaKey} con ${saldoInicial} horas...`);
      await salRef.update({
        [`bolsas.${bolsaKey}`]: {
          articulo_id: articuloId,
          anio_origen: ANIO_ORIGEN_GLOBAL,
          cantidad_inicial: saldoInicial,
          disponible: saldoInicial,
          consumido: 0,
          unidad: "horas",
          creado_en: FieldValue.serverTimestamp(),
          ultima_actualizacion: FieldValue.serverTimestamp(),
        },
        "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
      });
      console.log(`${TAG} Bolsa creada.`);
    } else {
      console.log(`${TAG} (dry-run) Se crearía bolsa ${bolsaKey} con ${saldoInicial}hs.`);
    }
  }
} else {
  console.log(`${TAG} Documento saldo global NO existe.`);
  if (apply) {
    console.log(`${TAG} Creando documento ${salId} con bolsa ${bolsaKey} (${saldoInicial}hs)...`);
    await salRef.set({
      persona_id: personaId,
      tipo: "global",
      bolsas: {
        [bolsaKey]: {
          articulo_id: articuloId,
          anio_origen: ANIO_ORIGEN_GLOBAL,
          cantidad_inicial: saldoInicial,
          disponible: saldoInicial,
          consumido: 0,
          unidad: "horas",
          creado_en: FieldValue.serverTimestamp(),
          ultima_actualizacion: FieldValue.serverTimestamp(),
        },
      },
      metadata: {
        version_aplicada_id: versionIdArg,
        ultima_sincronizacion: FieldValue.serverTimestamp(),
      },
    });
    console.log(`${TAG} Documento y bolsa creados.`);
  } else {
    console.log(`${TAG} (dry-run) Se crearía doc ${salId} con bolsa ${bolsaKey} (${saldoInicial}hs).`);
  }
}

// ── 4. Motor V2 dry-run ────────────────────────────────────────────────────
const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
console.log("---");
console.log(`${TAG} Ejecutando motor V2 Patrón C...`);
console.log(`${TAG}   fecha_desde: ${fechaHoy}`);
console.log(`${TAG}   horas_solicitadas: ${horasSolicitar}`);

try {
  const motor = await runPatronCAltaMotorV2({
    db,
    solicitud: {
      titular_persona_id: personaId,
      articulo_id: articuloId,
      version_aplicada_id: versionIdArg,
      fecha_desde: fechaHoy,
      fecha_hasta: fechaHoy,
      horas_solicitadas: horasSolicitar,
    },
    authToken: null,
    versionData,
    versionId: versionIdArg,
  });

  console.log("---");
  console.log(`${TAG} RESULTADO MOTOR:`);
  console.log(`${TAG}   ok: ${motor.ok}`);
  console.log(`${TAG}   eligible: ${motor.eligible}`);
  console.log(`${TAG}   fase_corte: ${motor.fase_corte ?? "(ninguna)"}`);
  console.log(`${TAG}   cantidad_consumo: ${motor.cantidad_consumo}`);
  console.log(`${TAG}   unidad_consumo: ${motor.unidad_consumo}`);
  console.log(`${TAG}   saldo_disponible: ${motor.saldo_disponible}`);
  console.log(`${TAG}   saldo_restante_preview: ${motor.saldo_restante_preview}`);
  console.log(`${TAG}   bolsa_id: ${motor.bolsa_id}`);
  console.log(`${TAG}   saldo_doc_id: ${motor.saldo_doc_id}`);
  console.log(`${TAG}   grupo_trabajo_id_ancla: ${motor.grupo_trabajo_id_ancla}`);

  if (motor.motor_snapshot) {
    console.log(`${TAG}   motor_snapshot.motor_version: ${motor.motor_snapshot.motor_version}`);
    console.log(`${TAG}   motor_snapshot.eligible: ${motor.motor_snapshot.eligible}`);
    const checks = motor.motor_snapshot.checks || motor.checks || [];
    console.log(`${TAG}   checks (${checks.length}):`);
    for (const c of checks) {
      const icon = c.nivel === "ok" ? "✓" : c.nivel === "bloqueante" ? "✗" : "⚠";
      console.log(`${TAG}     ${icon} [${c.fase}] ${c.codigo}: ${c.detalle}`);
    }
    const warns = motor.motor_snapshot.warnings || motor.warnings || [];
    if (warns.length > 0) {
      console.log(`${TAG}   warnings (${warns.length}):`);
      for (const w of warns) {
        console.log(`${TAG}     ⚠ ${w.codigo}: ${w.copy || w.detalle || ""}`);
      }
    }
    if (motor.config_usada) {
      console.log(`${TAG}   config_usada.motor_tipo: ${motor.config_usada.motor_tipo}`);
      console.log(`${TAG}   config_usada.version_aplicada_id: ${motor.config_usada.version_aplicada_id}`);
    }
  }

  if (motor.codigos?.length) {
    console.log(`${TAG}   codigos: ${motor.codigos.join(", ")}`);
  }
  if (motor.mensajes?.length) {
    console.log(`${TAG}   mensajes: ${motor.mensajes.join(" | ")}`);
  }

  console.log("---");
  if (motor.ok) {
    console.log(`${TAG} ✓ SMOKE TEST PASSED — Motor Patrón C V2 eligible, ${motor.cantidad_consumo}hs, saldo restante ${motor.saldo_restante_preview}hs.`);
  } else {
    console.log(`${TAG} ✗ SMOKE TEST: motor rechazó la solicitud.`);
    console.log(`${TAG}   Revisar checks arriba para diagnóstico.`);
  }
} catch (err) {
  console.error(`${TAG} ✗ ERROR MOTOR: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
}

process.exit(0);
