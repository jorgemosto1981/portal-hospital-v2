/**
 * Auditoría Fase 0 — primer plan mensual Sala Internación 1 / 2026-05.
 * Solo lectura Firestore (firebase-admin).
 *
 * Uso: node scripts/audit-fase0-plan-mensual.mjs
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_ID = "plt_01KSMNGHNTJAYC19Z11Q5ZVT5M";
const PERIODO = "2026-05";

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

function ts(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  return v;
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("[audit-fase0] GOOGLE_APPLICATION_CREDENTIALS no configurado:", gac);
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const gruposSnap = await db.collection("grupos_de_trabajo").get();
const grupos = gruposSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((g) => /sala.*internaci/i.test(String(g.nombre || g.codigo || g.titulo || "")));

console.log("=== GRUPOS Sala Internación ===");
console.log(JSON.stringify(
  grupos.map((g) => ({ id: g.id, nombre: g.nombre, codigo: g.codigo, activo: g.activo })),
  null,
  2,
));

const grupoId = grupos[0]?.id;
if (!grupoId) {
  console.log("\n[audit-fase0] SIN_GRUPO: no se encontró Sala Internación");
  process.exit(1);
}

const planSnap = await db.collection("planes_turno_servicio").doc(PLAN_ID).get();
console.log("\n=== PLAN plt_01KSM ===");
if (!planSnap.exists) {
  console.log("NO_EXISTE");
} else {
  const p = planSnap.data();
  console.log(JSON.stringify({
    id: planSnap.id,
    estado: p.estado,
    tipo_plan: p.tipo_plan,
    periodo: p.periodo,
    grupo_id: p.grupo_id,
    materializacion_fallida: p.materializacion_fallida,
    materializacion_error: p.materializacion_error || null,
    agentes_count: (p.agentes || []).length,
    creado_en: ts(p.creado_en),
    actualizado_en: ts(p.actualizado_en),
  }, null, 2));
}

const planesSnap = await db
  .collection("planes_turno_servicio")
  .where("grupo_id", "==", grupoId)
  .where("periodo", "==", PERIODO)
  .get();

console.log("\n=== PLANES grupo", grupoId, "periodo", PERIODO, "===");
console.log(JSON.stringify(
  planesSnap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      estado: p.estado,
      tipo_plan: p.tipo_plan,
      materializacion_fallida: p.materializacion_fallida,
      agentes: (p.agentes || []).length,
    };
  }),
  null,
  2,
));

const habilitados = planesSnap.docs.filter((d) => d.data().estado === "HABILITADO");
if (habilitados.length > 1) {
  console.log("\n[RIESGO] PLT-APR-DUP: más de un HABILITADO para mismo grupo+período");
} else if (habilitados.length === 1 && planSnap.exists && habilitados[0].id !== PLAN_ID) {
  console.log("\n[RIESGO] Ya existe otro plan HABILITADO:", habilitados[0].id);
}

const hlgSnap = await db
  .collection("historial_laboral_grupos")
  .where("grupo_de_trabajo_id", "==", grupoId)
  .limit(50)
  .get();

console.log("\n=== HLG vigentes mayo 2026 ===");
const hlgs = [];
for (const d of hlgSnap.docs) {
  const h = d.data();
  const fi = h.fecha_inicio || "";
  const ff = h.fecha_fin || "";
  const vigenteMayo = (!fi || fi <= "2026-05-31") && (!ff || ff >= "2026-05-01");
  if (!vigenteMayo) continue;

  let tipoPatron = "";
  let regimenNombre = "";
  if (h.regimen_horario_id) {
    const reg = await db.collection("cfg_regimen_horario").doc(h.regimen_horario_id).get();
    if (reg.exists) {
      tipoPatron = reg.data().tipo_patron || "";
      regimenNombre = reg.data().nombre || reg.id;
    } else {
      tipoPatron = "REG_NO_EXISTE";
    }
  }

  let personaLabel = h.persona_id;
  if (h.persona_id) {
    const per = await db.collection("personas").doc(h.persona_id).get();
    if (per.exists) {
      const pd = per.data();
      personaLabel = [pd.apellido, pd.nombre].filter(Boolean).join(", ") || h.persona_id;
    }
  }

  hlgs.push({
    hlg_id: d.id,
    persona_id: h.persona_id,
    persona_label: personaLabel,
    regimen_horario_id: h.regimen_horario_id,
    regimen_nombre: regimenNombre,
    tipo_patron: tipoPatron,
    fecha_inicio: fi,
    fecha_fin: ff || null,
  });
}
console.log(JSON.stringify(hlgs, null, 2));

const planificados = hlgs.filter((h) => h.tipo_patron === "planificado");
const fijos = hlgs.filter((h) => h.tipo_patron === "fijo");
const rotativos = hlgs.filter((h) => h.tipo_patron === "rotativo");

console.log("\n=== RESUMEN FASE 0 ===");
const bloqueos = [];
if (habilitados.length > 1) bloqueos.push("PLT-APR-DUP: múltiples HABILITADO");
if (planificados.length === 0) bloqueos.push("Sin agente planificado en mayo");

console.log(JSON.stringify({
  grupo_id: grupoId,
  periodo: PERIODO,
  planes_mayo: planesSnap.size,
  habilitados_mayo: habilitados.length,
  hlg_vigentes_mayo: hlgs.length,
  planificados: planificados.length,
  fijos: fijos.length,
  rotativos: rotativos.length,
  bloqueos,
  listo_fase1: bloqueos.length === 0,
}, null, 2));
