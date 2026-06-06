/**
 * R2 — Re-derivar agentes[].dias de planes mensuales con enriquecerAgentesDiasPlan (R0).
 *
 * Uso:
 *   node scripts/reimpact-plan-mensual-r2.mjs
 *   node scripts/reimpact-plan-mensual-r2.mjs --apply
 *   node scripts/reimpact-plan-mensual-r2.mjs --apply --plan-id=plt_...
 *
 * Por defecto: dry-run sobre planes HABILITADO|EN_REVISION mensual (excl. plt_inc, eliminado).
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { enriquecerAgentesDiasPlan } = require(
  join(repoRoot, "functions/modules/asistencia/planEnriquecimientoDias.js"),
);
const { listarHuecosTurnoEnAgentes } = require(
  join(repoRoot, "functions/modules/asistencia/validacionesPlanTurno.js"),
);
const { buildPlanMetaPayload, planRolDeDoc } = require(
  join(repoRoot, "functions/modules/asistencia/planTurnoServicioMeta.js"),
);

const COL = "planes_turno_servicio";
const PLAN_ROL_INC = "incorporacion";
const ESTADOS = new Set(["HABILITADO", "EN_REVISION", "BORRADOR"]);

function parseArgs(argv) {
  const opts = { apply: false, planId: "" };
  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg.startsWith("--plan-id=")) opts.planId = arg.slice("--plan-id=".length).trim();
  }
  return opts;
}

function loadSa() {
  const gac = readFileSync(join(repoRoot, ".env.v2.local"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="))
    ?.split("=")
    .slice(1)
    .join("=")
    .trim()
    .replace(/^["']|["']$/g, "");
  return JSON.parse(readFileSync(gac, "utf8"));
}

function planElegible(id, data, opts) {
  if (!data || data.eliminado === true) return false;
  if (String(data.tipo_plan || "") !== "mensual") return false;
  if (!ESTADOS.has(String(data.estado || ""))) return false;
  if (planRolDeDoc(data) === PLAN_ROL_INC) return false;
  if (opts.planId && id !== opts.planId) return false;
  return true;
}

function agentesEntrada(plan) {
  return (plan.agentes || []).map((ag) => ({
    persona_id: ag.persona_id,
    regimen_horario_id: ag.regimen_horario_id,
    hlg_id: ag.hlg_id,
    regimen_fecha_ancla: ag.regimen_fecha_ancla || null,
    dias: ag.dias && typeof ag.dias === "object" ? ag.dias : {},
  }));
}

const opts = parseArgs(process.argv.slice(2));
if (!getApps().length) initializeApp({ credential: cert(loadSa()) });
const db = getFirestore();

console.error(`R2 reimpact plan mensual — modo: ${opts.apply ? "APPLY" : "dry-run"}`);
if (opts.planId) console.error("  filtro plan_id:", opts.planId);

const snap = await db.collection(COL).get();
const candidatos = snap.docs.filter((d) => planElegible(d.id, d.data(), opts));

if (candidatos.length === 0) {
  console.log("Sin planes elegibles.");
  process.exit(0);
}

let totalHuecosAntes = 0;
let totalHuecosDespues = 0;
const filas = [];

for (const doc of candidatos) {
  const plan = doc.data();
  const antes = listarHuecosTurnoEnAgentes(plan.agentes || []).length;
  const agentesIn = agentesEntrada(plan);
  const agentesOut = await enriquecerAgentesDiasPlan({
    periodo: plan.periodo,
    planId: doc.id,
    agentes: agentesIn,
  });
  const despues = listarHuecosTurnoEnAgentes(agentesOut).length;
  totalHuecosAntes += antes;
  totalHuecosDespues += despues;

  filas.push({
    plan_id: doc.id,
    periodo: plan.periodo,
    estado: plan.estado,
    grupo_id: plan.grupo_id,
    huecos_antes: antes,
    huecos_despues: despues,
    agentesOut,
  });

  console.log(
    `${doc.id} · ${plan.periodo} · ${plan.estado} · huecos ${antes} → ${despues}`,
  );

  if (opts.apply && agentesOut.length > 0) {
    const meta = buildPlanMetaPayload({
      agentes: agentesOut,
      plan_rol: planRolDeDoc(plan),
      plan_padre_id: plan.plan_padre_id,
    });
    await doc.ref.set(
      {
        agentes: agentesOut,
        ...meta,
        actualizado_en: FieldValue.serverTimestamp(),
        reimpacto_r2_en: FieldValue.serverTimestamp(),
        reimpacto_r2_nota: "R0 mergeCeldaPlanConResolucion",
      },
      { merge: true },
    );
  }
}

console.log("\n=== Resumen R2 ===");
console.log(`Planes procesados: ${filas.length}`);
console.log(`Huecos US-9 total: ${totalHuecosAntes} → ${totalHuecosDespues}`);
if (!opts.apply) {
  console.log("\nDry-run. Re-ejecutar con --apply para persistir.");
} else {
  console.log("\nPersistido en Firestore.");
}

process.exit(totalHuecosDespues > 0 ? 2 : 0);
