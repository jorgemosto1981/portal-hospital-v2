/**
 * Fase 3 — Smoke solicitud LAO (dispara `onSolicitudArticuloLaoMotorValidate`).
 *
 * Crea un doc en `solicitudes_articulo` igual que `crearSolicitudArticuloLaoBorrador` (cliente),
 * espera a que el trigger actualice estado y (si aplica) descuente saldo.
 *
 * Uso (raíz repo, credencial como `lao-smoke-checkin-bolsas.mjs`):
 *   node scripts/lao-smoke-solicitud-borrador.mjs
 *   node scripts/lao-smoke-solicitud-borrador.mjs --apply --anio-bolsa=2024
 *
 * Opciones:
 *   --apply
 *   --dni=28914247
 *   --persona-id=per_...        (omite búsqueda por DNI)
 *   --articulo=art_01KRNYDN5WR7RER7MWXRZ817E7
 *   --anio-bolsa=2024           (debe existir bolsa; debe coincidir versión publicada)
 *   --fecha-desde=2026-01-15   (Y-m-d)
 *   --poll-sec=45
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const { ulid } = require(join(repoRoot, "web/node_modules/ulid/dist/index.umd.js"));
const { resolvePublishedLaoVersion } = require(join(repoRoot, "functions/modules/shared/laoVersionResolverDb.js"));

const ESTADO_BORRADOR = "cfg_esa_borrador";
const SOL_COL = "solicitudes_articulo";

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
    else if (a.startsWith("--dni=")) out.dni = a.slice(6);
    else if (a.startsWith("--persona-id=")) out.personaId = a.slice(13);
    else if (a.startsWith("--articulo=")) out.articulo = a.slice(11);
    else if (a.startsWith("--anio-bolsa=")) out.anioBolsa = a.slice(13);
    else if (a.startsWith("--fecha-desde=")) out.fechaDesde = a.slice(14);
    else if (a.startsWith("--poll-sec=")) out.pollSec = a.slice(11);
    else if (a.startsWith("--version-id=")) out.versionId = a.slice(13);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const apply = args.apply === true;
const dniNorm = String(args.dni ?? "28914247").replace(/\D/g, "");
const articuloId = String(args.articulo ?? "art_01KRNYDN5WR7RER7MWXRZ817E7").trim();
const anioBolsa = Number(args.anioBolsa ?? "2024");
let fechaDesde = String(args.fechaDesde ?? "2026-01-15").trim().slice(0, 10);
const pollSec = Math.min(120, Math.max(5, Number(args.pollSec ?? "45")));

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("[lao-smoke-solicitud] Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(gac) });
}

const db = getFirestore();

/** @type {string} */
let personaId = String(args.personaId ?? "").trim();

if (!personaId) {
  if (!/^\d{6,12}$/.test(dniNorm)) {
    console.error("[lao-smoke-solicitud] DNI inválido o pasá --persona-id=");
    process.exit(1);
  }
  const ps = await db.collection("personas").where("dni", "==", dniNorm).limit(2).get();
  if (ps.empty) {
    console.error(`[lao-smoke-solicitud] No personas dni=${dniNorm}`);
    process.exit(1);
  }
  if (ps.size > 1) {
    console.error("[lao-smoke-solicitud] DNI duplicado.");
    process.exit(1);
  }
  personaId = ps.docs[0].id;
}

if (!/^per_/i.test(personaId)) {
  console.error("[lao-smoke-solicitud] persona_id inválido.");
  process.exit(1);
}
if (!Number.isInteger(anioBolsa) || anioBolsa < 2000 || anioBolsa > 2100) {
  console.error("[lao-smoke-solicitud] --anio-bolsa inválido.");
  process.exit(1);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
  console.error("[lao-smoke-solicitud] --fecha-desde debe ser YYYY-MM-DD.");
  process.exit(1);
}

let versionId = String(args.versionId ?? "").trim();
if (!versionId) {
  const res = await resolvePublishedLaoVersion(db, articuloId, anioBolsa);
  versionId = res.versionId;
}

const solicitudId = `sol_${ulid()}`;

console.log("[lao-smoke-solicitud] proyecto:", db.app?.options?.projectId ?? "(default)");
console.log("[lao-smoke-solicitud] solicitud_id:", solicitudId);
console.log("[lao-smoke-solicitud] persona_id:", personaId, args.personaId ? "" : `(DNI ${dniNorm})`);
console.log("[lao-smoke-solicitud] articulo:", articuloId, "· año bolsa:", anioBolsa, "· version_aplicada:", versionId);
console.log("[lao-smoke-solicitud] fecha_desde:", fechaDesde);
console.log("[lao-smoke-solicitud] modo:", apply ? "APLICAR + poll trigger" : "dry-run");

if (!apply) {
  console.log("[lao-smoke-solicitud] Fin dry-run. Agregar --apply.");
  process.exit(0);
}

const ref = db.collection(SOL_COL).doc(solicitudId);
await ref.set({
  articulo_id: articuloId,
  titular_persona_id: personaId,
  actor_alta_persona_id: personaId,
  version_aplicada: versionId,
  fecha_desde: fechaDesde,
  anio_origen_bolsa: anioBolsa,
  estado_solicitud_id: ESTADO_BORRADOR,
  schema_version: 1,
  creado_en: FieldValue.serverTimestamp(),
  actualizado_en: FieldValue.serverTimestamp(),
});

console.log("[lao-smoke-solicitud] Doc creado (borrador). Esperando trigger hasta", pollSec, "s…");

const deadline = Date.now() + pollSec * 1000;
/** @type {Record<string, unknown> | undefined} */
let last;
while (Date.now() < deadline) {
  const snap = await ref.get();
  last = snap.data();
  const est = last?.estado_solicitud_id;
  if (est && est !== ESTADO_BORRADOR) {
    console.log("[lao-smoke-solicitud] Estado actualizado:", est);
    break;
  }
  await delay(2000);
}

if (!last) {
  console.error("[lao-smoke-solicitud] No se pudo releer solicitud.");
  process.exit(1);
}

console.log("[lao-smoke-solicitud] Resumen:");
console.log(JSON.stringify({
  estado_solicitud_id: last.estado_solicitud_id,
  motor_descuento_aplicado: last.motor_descuento_aplicado,
  motor_dias_descontados: last.motor_dias_descontados,
  motor_bolsa_id: last.motor_bolsa_id,
  motor_motivos_ineligibilidad: last.motor_motivos_ineligibilidad,
  motor_error_contexto: last.motor_error_contexto,
  motor_snapshot: last.motor_snapshot,
}, null, 2));

if (last.estado_solicitud_id === ESTADO_BORRADOR) {
  console.warn("[lao-smoke-solicitud] Sigue en BORRADOR: revisá logs Cloud Functions o aumentá --poll-sec.");
  process.exit(2);
}

if (last.estado_solicitud_id === "cfg_esa_rechazada") {
  process.exit(1);
}

console.log("[lao-smoke-solicitud] OK.");
