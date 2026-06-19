/**
 * Invalida todos los overrides_turno activos de un GDT en un mes calendario
 * y rematerializa teoría + vis_* del grupo (plan / HLG, sin gestión de turno).
 *
 *   node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs --gdt=gdt_... --periodo=2026-06
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs --gdt=... --periodo=2026-06 --apply
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { assertFirestoreSeedAllowed } from "./seed-v2/guard-no-seed.mjs";

const APPLY = process.argv.includes("--apply");
const SANACION_TAG = "sanear-invalidar-overrides-grilla-gdt-mes";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildAsiDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { materializarGrupoMes } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);

const COL_ASI = "asistencia_diaria";
const COL_HLG = "historial_laboral_grupos";

function loadServiceAccount() {
  const envFile = join(repoRoot, ".env.v2.local");
  let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!gac) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        gac = t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
  return JSON.parse(readFileSync(gac, "utf8"));
}

function parseArgs() {
  let gdt = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
  let periodo = "2026-06";
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--gdt=")) gdt = a.slice(6).trim();
    if (a.startsWith("--periodo=")) periodo = a.slice(10).trim();
  }
  if (!/^gdt_/i.test(gdt) || !/^\d{4}-\d{2}$/.test(periodo)) {
    console.error("Uso: --gdt=gdt_... --periodo=YYYY-MM [--apply]");
    process.exit(1);
  }
  const [y, m] = periodo.split("-").map(Number);
  return { gdt, periodo, anio: y, mes: m };
}

/** @param {number} anio @param {number} mes */
function diasDelMes(anio, mes) {
  const n = new Date(anio, mes, 0).getDate();
  const out = [];
  for (let d = 1; d <= n; d++) {
    out.push(`${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** @param {Record<string, unknown>|null|undefined} ov @param {string} gdt */
function overrideActivoEnGrupo(ov, gdt) {
  if (!ov || typeof ov !== "object") return false;
  if (ov.invalidado_por_replanificacion === true || ov.eliminado === true) return false;
  const g = String(ov.grupo_de_trabajo_id || ov.grupo_trabajo_id || "").trim();
  return g === gdt;
}

/** @param {Array<Record<string, unknown>>|null|undefined} overrides @param {string} gdt */
function invalidarOverridesGrupo(overrides, gdt) {
  const list = Array.isArray(overrides) ? overrides : [];
  let tocados = 0;
  const tipos = /** @type {Record<string, number>} */ ({});
  const next = list.map((ov) => {
    if (!overrideActivoEnGrupo(ov, gdt)) return ov;
    tocados += 1;
    const t = String(ov.tipo || "sin_tipo");
    tipos[t] = (tipos[t] || 0) + 1;
    return {
      ...ov,
      invalidado_por_replanificacion: true,
      invalidado_en: new Date().toISOString(),
      invalidado_por_sanacion: SANACION_TAG,
    };
  });
  return { next, tocados, tipos };
}

/** @param {import("firebase-admin/firestore").Firestore} db @param {string} gdt @param {string} primerDia @param {string} ultimoDia */
async function listarAgentesMes(db, gdt, primerDia, ultimoDia) {
  const hlgSnap = await db
    .collection(COL_HLG)
    .where("grupo_de_trabajo_id", "==", gdt)
    .where("activo", "==", true)
    .get();
  const ids = new Set();
  for (const doc of hlgSnap.docs) {
    const d = doc.data();
    const fi = String(d.fecha_inicio || "").trim();
    const ff = String(d.fecha_fin || "").trim();
    if (fi && fi > ultimoDia) continue;
    if (ff && ff < primerDia) continue;
    const pid = String(d.persona_id || "").trim();
    if (pid) ids.add(pid);
  }
  return [...ids].sort();
}

if (APPLY) {
  assertFirestoreSeedAllowed("sanear-invalidar-overrides-grilla-gdt-mes");
}

const { gdt, periodo, anio, mes } = parseArgs();
const fechas = diasDelMes(anio, mes);
const primerDia = fechas[0];
const ultimoDia = fechas[fechas.length - 1];

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const db = getFirestore();

console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
console.log(`GDT: ${gdt} · período: ${periodo} · ${fechas.length} días\n`);

const agentes = await listarAgentesMes(db, gdt, primerDia, ultimoDia);
console.log(`Agentes HLG vigentes en mes: ${agentes.length}`);
if (!agentes.length) {
  console.error("FAIL: sin agentes para el grupo/mes.");
  process.exit(1);
}

/** @type {Array<{ personaId: string, fecha: string, asiId: string, tocados: number, tipos: Record<string, number> }>} */
const filasPlan = [];
let totalOverrides = 0;
const tiposGlobal = /** @type {Record<string, number>} */ ({});
let asiConOverrides = 0;

for (const personaId of agentes) {
  for (const fecha of fechas) {
    const asiId = buildAsiDocumentId(personaId, fecha);
    const snap = await db.collection(COL_ASI).doc(asiId).get();
    const overrides = snap.exists ? snap.data()?.overrides_turno : [];
    const { tocados, tipos } = invalidarOverridesGrupo(overrides || [], gdt);
    if (tocados > 0) {
      asiConOverrides += 1;
      totalOverrides += tocados;
      for (const [k, v] of Object.entries(tipos)) {
        tiposGlobal[k] = (tiposGlobal[k] || 0) + v;
      }
      filasPlan.push({ personaId, fecha, asiId, tocados, tipos });
    }
  }
}

console.log("\n--- Resumen overrides activos a invalidar ---");
console.log(`Documentos asi con ≥1 override (${gdt}): ${asiConOverrides}`);
console.log(`Total overrides: ${totalOverrides}`);
console.log("Por tipo:", tiposGlobal);

if (filasPlan.length > 0 && filasPlan.length <= 40) {
  console.log("\nDetalle:");
  for (const row of filasPlan) {
    console.log(
      `  ${row.fecha} ${row.personaId.slice(0, 20)}… → ${row.tocados} (${JSON.stringify(row.tipos)})`,
    );
  }
} else if (filasPlan.length > 40) {
  console.log(`\n(primeras 15 de ${filasPlan.length} celdas con overrides)`);
  for (const row of filasPlan.slice(0, 15)) {
    console.log(`  ${row.fecha} ${row.personaId} → ${row.tocados}`);
  }
}

if (!APPLY) {
  console.log("\nDry-run OK. Para aplicar invalidación + rematerializar mes:");
  console.log(
    `  ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-invalidar-overrides-grilla-gdt-mes.mjs --gdt=${gdt} --periodo=${periodo} --apply`,
  );
  process.exit(0);
}

console.log("\n--- Invalidando overrides ---");
let escritos = 0;
for (const row of filasPlan) {
  const ref = db.collection(COL_ASI).doc(row.asiId);
  const snap = await ref.get();
  const { next, tocados } = invalidarOverridesGrupo(snap.data()?.overrides_turno || [], gdt);
  if (!tocados) continue;
  await ref.update({
    overrides_turno: next,
    actualizado_en: FieldValue.serverTimestamp(),
  });
  escritos += 1;
}
console.log(`asi_* actualizados: ${escritos}`);

console.log("\n--- Rematerializando grupo/mes ---");
const t0 = Date.now();
const mat = await materializarGrupoMes({ grupoId: gdt, anio, mes });
console.log(JSON.stringify({ ...mat, elapsed_ms: Date.now() - t0 }, null, 2));

if (!mat.ok) {
  console.error("\nFAIL: materializarGrupoMes reportó fallos.");
  process.exit(1);
}

console.log(
  `\nPASS: overrides ${gdt} invalidados en ${periodo}; grilla rematerializada desde plan/HLG.`,
);
