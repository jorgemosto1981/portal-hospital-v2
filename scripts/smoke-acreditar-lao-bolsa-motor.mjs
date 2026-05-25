/**
 * Smoke test — acreditarLaoBolsaAgente vía Admin SDK (sin cantidad_inicial).
 *
 * Replica la lógica exacta del callable para verificar que el motor V2
 * resuelve el cupo automáticamente desde TSE + matriz configuración.
 *
 * Uso:
 *   node scripts/smoke-acreditar-lao-bolsa-motor.mjs                    # dry-run
 *   node scripts/smoke-acreditar-lao-bolsa-motor.mjs --apply            # escribe bolsa en producción
 *   node scripts/smoke-acreditar-lao-bolsa-motor.mjs --persona=per_...  # otro agente
 *   node scripts/smoke-acreditar-lao-bolsa-motor.mjs --anio=2025        # otro ejercicio
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
  saldoAnualDocId,
  buildBolsaPayload,
  pickBolsaParaConsumo,
  CFG_OS_INTERNO,
} = require(join(repoRoot, "functions/modules/shared/laoSaldosBolsa.js"));
const { resolvePublishedLaoVersion } = require(join(repoRoot, "functions/modules/shared/laoVersionResolverDb.js"));
const { versionMatchesAnioOrigen } = require(join(repoRoot, "functions/modules/shared/laoVersionResolver.js"));
const { gatherLaoAltaMotorContext } = require(join(repoRoot, "functions/modules/shared/solicitudLaoAltaMotorContext.js"));
const { runLaoAsignacionDiasCore } = require(join(repoRoot, "functions/modules/shared/laoAsignacionDiasCore.js"));

const TAG = "[smoke-acreditar]";

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
    else if (a.startsWith("--persona=")) out.persona = a.slice("--persona=".length);
    else if (a.startsWith("--articulo=")) out.articulo = a.slice("--articulo=".length);
    else if (a.startsWith("--anio=")) out.anio = a.slice("--anio=".length);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const personaId = String(args.persona ?? "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ").trim();
const articuloId = String(args.articulo ?? "art_01KRNYDN5WR7RER7MWXRZ817E7").trim();
const anioOrigen = Number(args.anio ?? 2026);

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
console.log(`${TAG} persona_id: ${personaId}`);
console.log(`${TAG} articulo_id: ${articuloId}`);
console.log(`${TAG} anio_origen: ${anioOrigen}`);
console.log(`${TAG} modo: ${apply ? "APLICAR (escribe Firestore)" : "DRY-RUN (solo simula)"}`);
console.log("---");

const versionResolved = await resolvePublishedLaoVersion(db, articuloId, anioOrigen);
const versionId = versionResolved.versionId;
const versionData = versionResolved.versionData;
console.log(`${TAG} versión resuelta: ${versionId}`);

if (!versionMatchesAnioOrigen(versionData, anioOrigen)) {
  console.error(`${TAG} ERROR: correspondencia_anio de la versión no coincide con anio_origen.`);
  process.exit(1);
}

const salId = saldoAnualDocId(personaId, anioOrigen);
if (!salId) {
  console.error(`${TAG} ERROR: saldo anual doc id inválido.`);
  process.exit(1);
}

const salRef = db.collection("saldos_articulo_agente").doc(salId);
const salSnap = await salRef.get();
const salData = salSnap.exists ? salSnap.data() || {} : {};
const existente = pickBolsaParaConsumo(salData, articuloId, anioOrigen);

if (existente?.bolsa?.es_arrastre === true) {
  console.error(`${TAG} ERROR: Bolsa ${anioOrigen} es arrastre de check-in; no se acredita por motor.`);
  process.exit(1);
}
if (existente) {
  const cons = Number(existente.bolsa.consumido) || 0;
  if (cons > 0) {
    console.error(`${TAG} ERROR: Bolsa ${anioOrigen} ya tiene consumo (${cons} días). Usar otro agente/ejercicio.`);
    process.exit(1);
  }
  console.warn(`${TAG} AVISO: bolsa ${anioOrigen} existe con consumido=0 — se reemplazará.`);
}

console.log(`${TAG} Invocando motor V2 sin cantidad_inicial (TSE + matriz)...`);
const fechaDesde = `${anioOrigen}-07-01`;
const ctx = await gatherLaoAltaMotorContext(db, {
  personaId,
  articuloId,
  versionId,
  fechaDesde,
});

const asignacionResult = runLaoAsignacionDiasCore({
  versionData: ctx.versionData,
  fechaDesdeYmd: fechaDesde,
  fechaHastaYmd: fechaDesde,
  anioOrigenBolsa: anioOrigen,
  anioCalendarioActual: anioOrigen,
  hlcArray: ctx.hlcArray,
  diasExternos: ctx.diasExternos,
  exclusionIntervals: ctx.exclusionIntervals,
  operadorCodigoPorId: ctx.operadorMap,
});

console.log("---");
console.log(`${TAG} RESULTADO MOTOR V2:`);
console.log(`  eligible:       ${asignacionResult.eligible}`);
console.log(`  motor_version:  ${asignacionResult.motor_version}`);
if (asignacionResult.asignacion) {
  const a = asignacionResult.asignacion;
  console.log(`  tse_dias:       ${a.tse_dias}`);
  console.log(`  tse_anos:       ${a.tse_anos}`);
  console.log(`  cupo (días):    ${a.cupo}`);
  console.log(`  operador_match: ${a.operador_codigo ?? a.operador_id ?? "-"}`);
  console.log(`  dias_base:      ${a.dias_base}`);
}
if (!asignacionResult.eligible) {
  console.error(`${TAG} Motor NO habilita acreditación:`);
  console.error(`  motivos: ${(asignacionResult.motivos_ineligibilidad || []).join(" | ")}`);
  process.exit(1);
}

const cantidadInicial = Number(asignacionResult.asignacion?.cupo);
if (!Number.isFinite(cantidadInicial) || cantidadInicial < 0) {
  console.error(`${TAG} ERROR: cupo resuelto inválido (${cantidadInicial}).`);
  process.exit(1);
}

console.log("---");
console.log(`${TAG} BOLSA A CREAR:`);
console.log(`  sal_id:           ${salId}`);
console.log(`  cantidad_inicial: ${cantidadInicial}`);
console.log(`  saldo_disponible: ${cantidadInicial}`);
console.log(`  version_id:       ${versionId}`);
console.log(`  origen:           ${CFG_OS_INTERNO} (motor V2, sin input manual)`);

if (!apply) {
  console.log("---");
  console.log(`${TAG} DRY-RUN completado. Agregá --apply para escribir en Firestore.`);
  process.exit(0);
}

const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
const codigoGrilla =
  (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "LAO";

const { bolsaId, bolsa } = buildBolsaPayload({
  articuloId,
  versionId,
  codigoGrilla: String(codigoGrilla),
  anioOrigen,
  cantidadInicial,
  esArrastre: false,
  origenSaldoId: CFG_OS_INTERNO,
});
bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

if (salSnap.exists) {
  await salRef.update({
    [`bolsas.${bolsaId}`]: bolsa,
    "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
  });
} else {
  await salRef.set({
    persona_id: personaId,
    anio_calendario: anioOrigen,
    bolsas: { [bolsaId]: bolsa },
    metadata: { ultima_sincronizacion: FieldValue.serverTimestamp() },
  });
}

console.log("---");
console.log(`${TAG} BOLSA ESCRITA. Verificando lectura...`);
const verSnap = await salRef.get();
const verData = verSnap.data() || {};
const bolsaGuardada = verData.bolsas?.[bolsaId];
if (bolsaGuardada) {
  console.log(`  cantidad_inicial: ${bolsaGuardada.cantidad_inicial}`);
  console.log(`  disponible:       ${bolsaGuardada.disponible}`);
  console.log(`  consumido:        ${bolsaGuardada.consumido}`);
  console.log(`  version_id_origen:${bolsaGuardada.version_id_origen}`);
  console.log(`  origen_saldo_id:  ${bolsaGuardada.origen_saldo_id}`);
  console.log(`  es_arrastre:      ${bolsaGuardada.es_arrastre}`);
} else {
  console.error(`${TAG} ERROR: no se encontró la bolsa después de escribir.`);
  process.exit(1);
}

console.log("---");
console.log(`${TAG} SMOKE TEST EXITOSO — Motor V2 resolvió ${cantidadInicial} días sin input manual.`);
