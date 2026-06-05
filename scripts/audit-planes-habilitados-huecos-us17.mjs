/**
 * US-17 — Inventario planes mensuales HABILITADO con huecos (regla US-9).
 * Solo lectura. Requiere GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local).
 *
 * Uso:
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs --periodo=2026-06 --json
 *   node scripts/audit-planes-habilitados-huecos-us17.mjs --out=reports/us17.json --max-plans=200
 *
 * Cada hueco US-9 se cruza con vis_* (jornada materializada):
 *   severidad ALTA  — sin rda_* en vis (hueco operativo)
 *   severidad MEDIA — con rda_* en vis (deuda de persistencia en plan)
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
const {
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));
const { COL_VISTAS_GRILLA_MES } = require(
  join(repoRoot, "functions/modules/shared/mdcComandosConstants.js"),
);

const COL = "planes_turno_servicio";
const SEVERIDAD_ALTA = "ALTA";
const SEVERIDAD_MEDIA = "MEDIA";
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

/** Misma señal que grilla GSO (`celdaTieneJornadaVis`). */
function celdaTieneJornadaMaterializada(cel) {
  if (!cel || typeof cel !== "object") return false;
  const ing = String(cel.rda_ingreso || "").trim();
  const egr = String(cel.rda_egreso || "").trim();
  if (ing || egr) return true;
  return Boolean(String(cel.rda_turno_id || "").trim());
}

function severidadHuecoRrhh(tieneJornadaVis) {
  return tieneJornadaVis ? SEVERIDAD_MEDIA : SEVERIDAD_ALTA;
}

function fechaAnclaDesdePeriodo(periodo) {
  const p = String(periodo || "").trim();
  if (/^\d{4}-\d{2}$/.test(p)) return `${p}-01`;
  return "";
}

/**
 * Cruza huecos US-9 con vis_* del mes (solo lectura, guía remediación RRHH).
 * @param {import('firebase-admin/firestore').Firestore} db
 */
async function enriquecerHuecosConVis(db, grupoId, periodo, huecos) {
  const gdt = String(grupoId || "").trim();
  const ancla = fechaAnclaDesdePeriodo(periodo);
  if (!gdt || !ancla || !Array.isArray(huecos) || huecos.length === 0) {
    return huecos.map((h) => ({
      ...h,
      severidad: SEVERIDAD_ALTA,
      tiene_materializacion: false,
    }));
  }

  const personaIds = [...new Set(huecos.map((h) => String(h.persona_id || "").trim()).filter(Boolean))];
  const visPorPersona = new Map();

  const refs = personaIds.map((pid) =>
    db.collection(COL_VISTAS_GRILLA_MES).doc(buildVisDocumentId(pid, ancla, gdt)),
  );
  if (refs.length > 0) {
    const snaps = await db.getAll(...refs);
    for (let i = 0; i < personaIds.length; i += 1) {
      const snap = snaps[i];
      const dias =
        snap?.exists && snap.data()?.dias && typeof snap.data().dias === "object"
          ? snap.data().dias
          : {};
      visPorPersona.set(personaIds[i], dias);
    }
  }

  return huecos.map((h) => {
    const pid = String(h.persona_id || "").trim();
    const ymd = String(h.ymd || "").trim();
    const diaKey = diaMesKeyDesdeYmd(ymd) || ymd.slice(8, 10);
    const dias = visPorPersona.get(pid) || {};
    const celVis = dias[diaKey] || dias[ymd] || null;
    const tieneMat = celdaTieneJornadaMaterializada(celVis);
    return {
      ...h,
      severidad: severidadHuecoRrhh(tieneMat),
      tiene_materializacion: tieneMat,
    };
  });
}

function contarPorSeveridad(huecos) {
  let alta = 0;
  let media = 0;
  for (const h of huecos) {
    if (h.severidad === SEVERIDAD_MEDIA) media += 1;
    else alta += 1;
  }
  return { alta, media };
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
  let totalHuecosAlta = 0;
  let totalHuecosMedia = 0;

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
        severidad_plan: SEVERIDAD_ALTA,
        anomalia_estructural: "sin_agentes",
        huecos_severidad_alta: 0,
        huecos_severidad_media: 0,
        huecos: [],
      });
      continue;
    }

    const huecosRaw = listarHuecosTurnoEnAgentes(agentes);
    if (huecosRaw.length === 0) continue;

    const grupoId = String(plan.grupo_id || "").trim();
    const periodo = String(plan.periodo || "").trim();
    const huecos = await enriquecerHuecosConVis(db, grupoId, periodo, huecosRaw);
    const { alta, media } = contarPorSeveridad(huecos);

    totalHuecos += huecos.length;
    totalHuecosAlta += alta;
    totalHuecosMedia += media;
    planesConHuecos.push({
      plan_id: doc.id,
      grupo_id: grupoId,
      periodo,
      plan_rol: String(plan.plan_rol || "principal").trim(),
      huecos_count: huecos.length,
      huecos_severidad_alta: alta,
      huecos_severidad_media: media,
      sin_agentes: false,
      huecos,
    });
  }

  const resumen = {
    generado_en: new Date().toISOString(),
    criterio: "US-9 / listarHuecosTurnoEnAgentes",
    clasificacion_rrhh: {
      ALTA:
        "turno_id vacío en plan y sin jornada en vis_* (hueco operativo); o plan HABILITADO sin agentes[] (anomalía estructural, severidad_plan ALTA)",
      MEDIA:
        "turno_id vacío en plan con jornada en vis_* (deuda de persistencia; confirmar en editor de plan)",
      sin_agentes:
        "agentes[] vacío o ausente: severidad_plan ALTA — rearmar dotación en el plan antes de habilitar (no aplica cruce vis_* por celda)",
    },
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
    total_huecos_severidad_alta: totalHuecosAlta,
    total_huecos_severidad_media: totalHuecosMedia,
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
    console.log(`Total celdas hueco (US-9): ${totalHuecos}`);
    console.log(`  severidad ALTA: ${totalHuecosAlta} · MEDIA: ${totalHuecosMedia}`);
    for (const row of planesConHuecos) {
      const extra = row.sin_agentes ? " [SIN_AGENTES·severidad_plan=ALTA]" : "";
      const sev =
        row.sin_agentes || row.huecos_count === 0
          ? ""
          : ` · ALTA=${row.huecos_severidad_alta} MEDIA=${row.huecos_severidad_media}`;
      console.log(
        `  - ${row.plan_id} · ${row.grupo_id} · ${row.periodo} · huecos=${row.huecos_count}${sev}${extra}`,
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
