/**
 * US-17 — Inventario planes mensuales HABILITADO con huecos (regla US-9).
 * Solo lectura. Requiere GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local).
 *
 * Uso:
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs --periodo=2026-06 --json
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs --out=reports/us17.json --max-plans=200
 */
import "./load-env-v2.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { listarHuecosTurnoEnAgentes } = require(
  join(repoRoot, "functions/modules/asistencia/validacionesPlanTurno.js"),
);

const COL = "planes_turno_servicio";
const PLAN_ROL_INCORPORACION = "incorporacion";

function parseArgs(argv) {
  const opts = {
    json: false,
    out: "",
    grupo: "",
    periodo: "",
    maxPlans: 0,
  };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--out=")) opts.out = arg.slice("--out=".length).trim();
    else if (arg.startsWith("--grupo=")) opts.grupo = arg.slice("--grupo=".length).trim();
    else if (arg.startsWith("--periodo=")) opts.periodo = arg.slice("--periodo=".length).trim();
    else if (arg.startsWith("--max-plans=")) {
      const n = Number(arg.slice("--max-plans=".length));
      if (Number.isFinite(n) && n > 0) opts.maxPlans = n;
    }
  }
  return opts;
}

function loadServiceAccount() {
  const envFile = join(repoRoot, ".env.v2.local");
  let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!gac) {
    try {
      for (const line of readFileSync(envFile, "utf8").split("\n")) {
        const t = line.trim();
        if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
          gac = t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
    } catch {
      // no-op
    }
  }
  if (!gac) {
    console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
    process.exit(1);
  }
  return JSON.parse(readFileSync(gac, "utf8"));
}

function planPasaFiltroUs17(data) {
  if (!data || typeof data !== "object") return false;
  if (data.eliminado === true) return false;
  if (String(data.tipo_plan || "") !== "mensual") return false;
  const rol = String(data.plan_rol || "principal").trim();
  if (rol === PLAN_ROL_INCORPORACION) return false;
  return true;
}

function initFirebase() {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }
  return getFirestore();
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ grupo: string, periodo: string }} filters
 */
async function cargarPlanesHabilitados(db, filters) {
  let q = db.collection(COL).where("estado", "==", "HABILITADO");
  if (filters.grupo) q = q.where("grupo_id", "==", filters.grupo);
  if (filters.periodo) q = q.where("periodo", "==", filters.periodo);
  const snap = await q.get();
  return snap.docs;
}

async function runAudit() {
  const opts = parseArgs(process.argv.slice(2));
  const db = initFirebase();

  console.error("US-17: auditoría planes HABILITADO (mensual, sin plt_inc)…");
  if (opts.grupo) console.error("  filtro grupo_id:", opts.grupo);
  if (opts.periodo) console.error("  filtro periodo:", opts.periodo);
  if (opts.maxPlans) console.error("  max-plans:", opts.maxPlans);

  const docs = await cargarPlanesHabilitados(db, {
    grupo: opts.grupo,
    periodo: opts.periodo,
  });

  const planesConHuecos = [];
  let escaneados = 0;
  let omitidosFiltro = 0;
  let sinAgentes = 0;
  let totalHuecos = 0;

  for (const doc of docs) {
    if (opts.maxPlans > 0 && escaneados >= opts.maxPlans) break;
    const plan = doc.data();
    if (!planPasaFiltroUs17(plan)) {
      omitidosFiltro += 1;
      continue;
    }
    escaneados += 1;

    const agentes = Array.isArray(plan.agentes) ? plan.agentes : [];
    if (agentes.length === 0) {
      sinAgentes += 1;
      planesConHuecos.push({
        plan_id: doc.id,
        grupo_id: String(plan.grupo_id || "").trim(),
        periodo: String(plan.periodo || "").trim(),
        plan_rol: String(plan.plan_rol || "principal").trim(),
        huecos_count: 0,
        sin_agentes: true,
        huecos: [],
      });
      continue;
    }

    const huecos = listarHuecosTurnoEnAgentes(agentes);
    if (huecos.length === 0) continue;

    totalHuecos += huecos.length;
    planesConHuecos.push({
      plan_id: doc.id,
      grupo_id: String(plan.grupo_id || "").trim(),
      periodo: String(plan.periodo || "").trim(),
      plan_rol: String(plan.plan_rol || "principal").trim(),
      huecos_count: huecos.length,
      sin_agentes: false,
      huecos,
    });
  }

  const resumen = {
    generado_en: new Date().toISOString(),
    criterio: "US-9 / listarHuecosTurnoEnAgentes",
    filtros: {
      estado: "HABILITADO",
      eliminado: "!= true",
      tipo_plan: "mensual",
      excluye_plan_rol: PLAN_ROL_INCORPORACION,
      grupo_id: opts.grupo || null,
      periodo: opts.periodo || null,
    },
    documentos_query_estado_habilitado: docs.length,
    planes_escaneados_us17: escaneados,
    planes_omitidos_filtro_us17: omitidosFiltro,
    planes_con_huecos_o_sin_agentes: planesConHuecos.length,
    planes_sin_agentes: sinAgentes,
    total_huecos_celdas: totalHuecos,
    planes: planesConHuecos,
  };

  if (opts.json) {
    const text = JSON.stringify(resumen, null, 2);
    if (opts.out) {
      const outPath = join(repoRoot, opts.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, text, "utf8");
      console.error("Reporte escrito:", outPath);
    } else {
      console.log(text);
    }
  } else {
    console.log("\n=== US-17 resumen ===");
    console.log(`Query HABILITADO: ${docs.length} doc(s)`);
    console.log(`Escaneados (filtro US-17): ${escaneados}`);
    console.log(`Omitidos (no mensual / eliminado / incorporación): ${omitidosFiltro}`);
    console.log(`Planes con huecos o sin agentes: ${planesConHuecos.length}`);
    console.log(`Sin agentes en plan: ${sinAgentes}`);
    console.log(`Total celdas hueco: ${totalHuecos}`);
    for (const row of planesConHuecos) {
      const extra = row.sin_agentes ? " [SIN_AGENTES]" : "";
      console.log(
        `  - ${row.plan_id} · ${row.grupo_id} · ${row.periodo} · huecos=${row.huecos_count}${extra}`,
      );
    }
    if (opts.out) {
      const outPath = join(repoRoot, opts.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(resumen, null, 2), "utf8");
      console.log("\nJSON completo:", outPath);
    }
  }

  console.error("Auditoría finalizada.");
}

runAudit().catch((e) => {
  console.error(e);
  process.exit(1);
});
