/**
 * Auditoría Fases 4-6 — plan HABILITADO plt_01KSM (Sala Internación 1 / 2026-05).
 * Verifica vis_*, capa_teorica fijos, días sin turno, consistencia plan vs asi_*.
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
const { buildAsiDocumentId, buildVisDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

const PLAN_ID = process.env.PLAN_ID || process.argv[2] || "plt_01KSMNGHNTJAYC19Z11Q5ZVT5M";
const GRUPO_ID = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const PERIODO = "2026-05";
const ANIO = 2026;
const MES = 5;

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
if (plan.estado !== "HABILITADO") {
  console.error("Plan no HABILITADO:", plan.estado);
  process.exit(1);
}

const agentes = plan.agentes || [];
const diasMes = new Date(ANIO, MES, 0).getDate();

function ymd(d) {
  return `${ANIO}-${String(MES).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const resultados = [];

for (const ag of agentes) {
  const pid = ag.persona_id;
  const regSnap = await db.collection("cfg_regimen_horario").doc(ag.regimen_horario_id).get();
  const tipoPatron = regSnap.exists ? regSnap.data().tipo_patron : "?";

  let perLabel = pid;
  const perSnap = await db.collection("personas").doc(pid).get();
  if (perSnap.exists) {
    const p = perSnap.data();
    perLabel = [p.apellido, p.nombre].filter(Boolean).join(", ") || pid;
  }

  const visId = buildVisDocumentId(pid, `${PERIODO}-01`);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const visDias = visSnap.exists ? visSnap.data().dias || {} : {};

  let diasConCapa = 0;
  let diasSinCapaLaborable = 0;
  let diasFrancoVis = 0;
  let diasConRdaNullLaborable = 0;
  let diasConSegmentos = 0;
  const muestrasProblema = [];

  for (let d = 1; d <= diasMes; d++) {
    const fecha = ymd(d);
    const diaKey = String(d).padStart(2, "0");
    const celPlan = ag.dias?.[fecha];
    const visDia = visDias[diaKey] || visDias[d] || {};

    const asiId = buildAsiDocumentId(pid, fecha);
    const asiSnap = await db.collection("asistencia_diaria").doc(asiId).get();
    const capa = asiSnap.exists ? asiSnap.data().capa_teorica : null;

    if (capa) {
      diasConCapa++;
      if ((capa.segmentos || []).length > 0) diasConSegmentos++;
    }

    const esFrancoPlan =
      !celPlan ||
      celPlan.tipo_dia === "franco" ||
      celPlan.tipo_dia === "no_laborable" ||
      !celPlan.turno_id;
    const esLaborablePlan =
      celPlan &&
      (celPlan.tipo_dia === "laborable" || celPlan.tipo_dia === "guardia") &&
      celPlan.turno_id;

    if (visDia.es_franco) diasFrancoVis++;

    if (tipoPatron === "planificado" && esLaborablePlan && !capa) {
      diasSinCapaLaborable++;
      if (muestrasProblema.length < 5) {
        muestrasProblema.push({ fecha, issue: "plan_laborable_sin_capa_teorica" });
      }
    }

    if (esLaborablePlan && visDia.rda_turno_id == null && !visDia.es_franco) {
      diasConRdaNullLaborable++;
      if (muestrasProblema.length < 5) {
        muestrasProblema.push({
          fecha,
          issue: "vis_sin_rda_turno_id",
          turno_plan: celPlan.turno_id,
        });
      }
    }
  }

  resultados.push({
    persona_label: perLabel,
    persona_id: pid,
    tipo_patron: tipoPatron,
    vis_existe: visSnap.exists,
    dias_mes: diasMes,
    dias_con_capa_teorica: diasConCapa,
    dias_con_segmentos: diasConSegmentos,
    dias_franco_vis: diasFrancoVis,
    dias_sin_capa_laborable_planificado: diasSinCapaLaborable,
    dias_vis_rda_null_laborable: diasConRdaNullLaborable,
    muestras_problema: muestrasProblema,
    ok:
      diasSinCapaLaborable === 0 &&
      diasConRdaNullLaborable === 0 &&
      (tipoPatron !== "planificado" || diasConCapa > 0),
  });
}

console.log("=== PLAN ===");
console.log(JSON.stringify({
  id: PLAN_ID,
  estado: plan.estado,
  periodo: plan.periodo,
  grupo_id: plan.grupo_id,
  materializacion_fallida: plan.materializacion_fallida,
}, null, 2));

console.log("\n=== AGENTES (Fases 4-6 backend) ===");
console.log(JSON.stringify(resultados, null, 2));

const todosOk = resultados.every((r) => r.ok);
console.log("\n=== CIERRE BACKEND ===");
console.log(JSON.stringify({
  fase4_backend_ok: todosOk,
  pendiente_ui_manual: [
    "Abrir /portal/jefe/planes-turno detalle plt_01KSM",
    "Login LOKITO -> /portal/grilla cronograma mayo",
    "Vista equipo jefe sin ? en CHAPARRO/MOSTO",
    "Gate licencia depende_rda dia con/sin turno",
  ],
}, null, 2));

process.exit(todosOk ? 0 : 1);
