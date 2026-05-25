/**
 * Fase 3 — Smoke check-in LAO (Admin SDK).
 *
 * Persiste el mismo modelo que la callable `persistirCheckinLaoBolsas`:
 * subcolección `cfg_articulos/.../versiones` → resuelve `ver_*` publicada por año,
 * docs `sal_{anio_origen}_per_{ulida}` → `bolsas.bol_art_*_{anio}` con arrastre.
 *
 * Por defecto: DNI 28914247, A=2026, artículo LAO oficial, años 2024 y 2025 con días configurables.
 *
 * Requiere cuenta de servicio (mismo patrón que `scripts/dev-set-portal-role-rrhh.mjs`):
 *   GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local o en el entorno.
 *
 * Uso (raíz del repo):
 *   node scripts/lao-smoke-checkin-bolsas.mjs                         # solo simula / imprime versión_id resueltas
 *   node scripts/lao-smoke-checkin-bolsas.mjs --apply                 # escribe Firestore producción/default del JSON
 *
 * Opciones:
 *   --apply              ejecutar escrituras (sin esto = dry-run)
 *   --dni=28914247
 *   --anio-a=2026
 *   --articulo=art_01KRNYDN5WR7RER7MWXRZ817E7
 *   --2024-dias=10
 *   --2025-dias=8
 *
 * Ver también: docs/v2/PLAN_LAO_BOLSAS_CHECKIN_SOLICITUD_V2.md (T1–T6)
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
  resolveCodigoGrillaForBolsa,
  CFG_OS_EXTERNO_INFORMADO,
} = require(join(repoRoot, "functions/modules/shared/laoSaldosBolsa.js"));
const { resolvePublishedLaoVersion } = require(join(repoRoot, "functions/modules/shared/laoVersionResolverDb.js"));
const { assertCheckinAnioAllowed } = require(join(repoRoot, "functions/modules/shared/laoVersionResolver.js"));

const COL_SALDOS = "saldos_articulo_agente";

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
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--dni=")) out.dni = a.slice("--dni=".length);
    else if (a.startsWith("--anio-a=")) out.anioA = a.slice("--anio-a=".length);
    else if (a.startsWith("--articulo=")) out.articulo = a.slice("--articulo=".length);
    else if (a.startsWith("--2024-dias=")) out.d2024 = a.slice("--2024-dias=".length);
    else if (a.startsWith("--2025-dias=")) out.d2025 = a.slice("--2025-dias=".length);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const dniNorm = String(args.dni ?? "28914247").replace(/\D/g, "");
const anioCorteA = Number(args.anioA ?? "2026");
const articuloId = String(args.articulo ?? "art_01KRNYDN5WR7RER7MWXRZ817E7").trim();
const dias2024 = Number(args.d2024 ?? "10");
const dias2025 = Number(args.d2025 ?? "8");

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("[lao-smoke-checkin] Falta GOOGLE_APPLICATION_CREDENTIALS válido (.env.v2.local o entorno).");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(gac) });
}

const db = getFirestore();

const filas = [
  { anio_origen: 2024, dias_disponibles: dias2024 },
  { anio_origen: 2025, dias_disponibles: dias2025 },
];

if (!/^\d{6,12}$/.test(dniNorm)) {
  console.error("[lao-smoke-checkin] DNI inválido.");
  process.exit(1);
}
if (!Number.isInteger(anioCorteA) || anioCorteA < 2000 || anioCorteA > 2100) {
  console.error("[lao-smoke-checkin] --anio-a inválido.");
  process.exit(1);
}

const ps = await db.collection("personas").where("dni", "==", dniNorm).limit(2).get();
if (ps.empty) {
  console.error(`[lao-smoke-checkin] No hay personas con dni=${dniNorm}`);
  process.exit(1);
}
if (ps.size > 1) {
  console.error("[lao-smoke-checkin] Más de una persona con ese DNI.");
  process.exit(1);
}

const personaId = ps.docs[0].id;

const coreSnap = await db.collection("cfg_articulos").doc(articuloId).get();
const articuloCodigoFallback =
  (coreSnap.exists && (coreSnap.data()?.codigo || coreSnap.data()?.nombre)) || "LAO";

console.log("[lao-smoke-checkin] proyecto:", db.app?.options?.projectId ?? "(default)");
console.log("[lao-smoke-checkin] persona_id:", personaId, "· DNI:", dniNorm);
console.log("[lao-smoke-checkin] articulo_id:", articuloId, "· A (corte):", anioCorteA);
console.log("[lao-smoke-checkin] modo:", apply ? "APLICAR" : "dry-run");

/** @type {Array<{ anio_origen: number, dias: number, version_id: string, sal_id: string, bolsa_id: string }>} */
const plan = [];

for (const fila of filas) {
  const anioOrigen = fila.anio_origen;
  const dias = fila.dias_disponibles;
  assertCheckinAnioAllowed(anioOrigen, anioCorteA);
  let versionId;
  let versionData;
  try {
    const resolved = await resolvePublishedLaoVersion(db, articuloId, anioOrigen);
    versionId = resolved.versionId;
    versionData = resolved.versionData;
  } catch (e) {
    console.error("[lao-smoke-checkin] No se resolvió versión publicada para año", anioOrigen, e?.message ?? e);
    process.exit(1);
  }

  const salId = saldoAnualDocId(personaId, anioOrigen);
  if (!salId) {
    console.error("[lao-smoke-checkin] sal_id inválido para año", anioOrigen);
    process.exit(1);
  }

  const codigoGrilla = resolveCodigoGrillaForBolsa(versionData, anioOrigen, articuloCodigoFallback);

  const { bolsaId, bolsa } = buildBolsaPayload({
    articuloId,
    versionId,
    codigoGrilla,
    anioOrigen,
    cantidadInicial: dias,
    esArrastre: true,
    origenSaldoId: CFG_OS_EXTERNO_INFORMADO,
  });

  const salSnap = await db.collection(COL_SALDOS).doc(salId).get();
  const salData = salSnap.exists ? salSnap.data() || {} : {};
  const existente = pickBolsaParaConsumo(salData, articuloId, anioOrigen);
  if (existente) {
    const cons = Number(existente.bolsa.consumido) || 0;
    if (cons > 0) {
      console.error(
        `[lao-smoke-checkin] Abort: ya existe bolsa ${anioOrigen} con consumido=${cons} en ${salId}. Ajuste manual RRHH o use otra persona.`,
      );
      process.exit(1);
    }
    console.warn(`[lao-smoke-checkin] Aviso: sustituyendo bolsa año ${anioOrigen} con consumido=0 en ${salId}`);
  }

  console.log(`  año ${anioOrigen}: ${dias} días → ${versionId} → ${salId} / ${bolsaId}`);
  plan.push({ anio_origen: anioOrigen, dias, version_id: versionId, sal_id: salId, bolsa_id: bolsaId, bolsa });
}

if (!apply) {
  console.log("[lao-smoke-checkin] Fin dry-run (agregá --apply para escribir).");
  process.exit(0);
}

for (const row of plan) {
  const salRef = db.collection(COL_SALDOS).doc(row.sal_id);
  const salSnap = await salRef.get();
  row.bolsa.ultima_actualizacion = FieldValue.serverTimestamp();

  if (salSnap.exists) {
    await salRef.update({
      [`bolsas.${row.bolsa_id}`]: row.bolsa,
      "metadata.ultima_sincronizacion": FieldValue.serverTimestamp(),
    });
  } else {
    await salRef.set({
      persona_id: personaId,
      anio_calendario: row.anio_origen,
      bolsas: { [row.bolsa_id]: row.bolsa },
      metadata: {
        ultima_sincronizacion: FieldValue.serverTimestamp(),
      },
    });
  }
}

await db.collection("personas").doc(personaId).set(
  {
    anio_corte_portal_a: anioCorteA,
    checkin_lao_registrado_en: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

console.log("[lao-smoke-checkin] OK — bolsas escritas. Verificación lectura:");
for (const row of plan) {
  const snap = await db.collection(COL_SALDOS).doc(row.sal_id).get();
  const d = snap.data() || {};
  const b = d.bolsas && d.bolsas[row.bolsa_id];
  const disp = b ? Number(b.disponible) : NaN;
  console.log(`  ${row.sal_id}: disponible=${Number.isFinite(disp) ? disp : "?"} · version_origen=${b?.version_id_origen ?? "?"}`);
}

console.log("[lao-smoke-checkin] Siguiente smoke: alta solicitud borrador LAO contra `titular_persona_id` este per_* (trigger onCreate). Ver PLAN T1–T3.");
console.log(
  "[lao-smoke-checkin] Patrones B/C: probar en UI con rectificación o `persistirCheckinSaldoEstandarLote` (oleada 3).",
);
