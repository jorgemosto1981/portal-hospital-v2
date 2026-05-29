/**
 * Auditoría vis_* vs plan HABILITADO — piloto junio 2026 Sala Internación 1.
 * Uso: node scripts/audit-vis-junio-2026.mjs [plan_id]
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

const PLAN_ID = process.env.PLAN_ID || process.argv[2] || "plt_01KSSPY2H5EZA925FQP4S1G2XW";
const ANIO = 2026;
const MES = 6;

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
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const planSnap = await db.collection("planes_turno_servicio").doc(PLAN_ID).get();
if (!planSnap.exists) {
  console.error("Plan no existe:", PLAN_ID);
  process.exit(1);
}
const plan = planSnap.data();

console.log("=== PLAN ===");
console.log(
  JSON.stringify(
    {
      id: PLAN_ID,
      estado: plan.estado,
      periodo: plan.periodo,
      grupo_id: plan.grupo_id,
      materializacion_fallida: plan.materializacion_fallida || null,
      tiene_grilla_aprobada: Boolean(plan.grilla_aprobada),
    },
    null,
    2,
  ),
);

if (plan.estado !== "HABILITADO") {
  console.error("Plan no está HABILITADO:", plan.estado);
  process.exit(1);
}

const diasMes = new Date(ANIO, MES, 0).getDate();
const ymd = (d) => `2026-06-${String(d).padStart(2, "0")}`;

const resultados = [];

for (const ag of plan.agentes || []) {
  const pid = ag.persona_id;
  const regSnap = await db.collection("cfg_regimen_horario").doc(ag.regimen_horario_id).get();
  const tipoPatron = regSnap.exists ? regSnap.data().tipo_patron : "?";
  const perSnap = await db.collection("personas").doc(pid).get();
  const p = perSnap.exists ? perSnap.data() : {};
  const label = [p.apellido, p.nombre].filter(Boolean).join(", ") || pid;

  const visId = buildVisDocumentId(pid, "2026-06-01");
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const dias = visSnap.exists ? visSnap.data().dias || {} : {};

  let laborable = 0;
  let franco = 0;
  let noLaborable = 0;
  let conHorario = 0;
  let laborableSinHorario = 0;
  let mismatchTipo = 0;
  const muestras = [];

  for (let d = 1; d <= diasMes; d += 1) {
    const dk = String(d).padStart(2, "0");
    const v = dias[dk] || {};
    const celPlan = ag.dias?.[ymd(d)] || {};
    const tv = String(v.tipo_dia || (v.es_franco ? "franco" : "")).trim().toLowerCase();
    const tp = String(celPlan.tipo_dia || "").trim().toLowerCase();

    if (tv === "laborable" || tv === "guardia") laborable += 1;
    if (tv === "franco") franco += 1;
    if (tv === "no_laborable") noLaborable += 1;
    if (v.rda_ingreso && v.rda_egreso) conHorario += 1;

    const esLabV = tv === "laborable" || tv === "guardia";
    const esLabP = tp === "laborable" || tp === "guardia";
    if (esLabV && !(v.rda_ingreso && v.rda_egreso) && v.es_feriado !== true) {
      laborableSinHorario += 1;
      if (muestras.length < 4) {
        muestras.push({ dia: dk, tipo_vis: tv, rda_ingreso: v.rda_ingreso, rda_egreso: v.rda_egreso });
      }
    }
    if (esLabP && tv && tv !== tp && tv !== "laborable" && tv !== "guardia") {
      mismatchTipo += 1;
    }
    if ((tp === "franco" && tv === "no_laborable") || (tp === "no_laborable" && tv === "franco")) {
      mismatchTipo += 1;
    }
  }

  const ok = visSnap.exists && laborableSinHorario === 0 && mismatchTipo === 0;
  resultados.push({
    persona: label,
    persona_id: pid,
    tipo_patron: tipoPatron,
    vis_id: visId,
    vis_existe: visSnap.exists,
    laborable,
    franco,
    no_laborable: noLaborable,
    con_horario: conHorario,
    laborable_sin_horario: laborableSinHorario,
    mismatch_tipo_plan_vis: mismatchTipo,
    muestras_problema: muestras,
    ok,
  });
}

console.log("\n=== VIS vs PLAN (junio 2026) ===");
console.log(JSON.stringify(resultados, null, 2));

const todosOk = resultados.every((r) => r.ok);
console.log("\n=== RESULTADO ===");
console.log(todosOk ? "OK — materialización coherente con plan." : "FALLAS — ver filas con ok:false");
process.exit(todosOk ? 0 : 1);
