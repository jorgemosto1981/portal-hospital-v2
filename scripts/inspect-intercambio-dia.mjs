/**
 * Inspección asi_* + vis_* para intercambio de guardia (QA).
 *
 *   node scripts/inspect-intercambio-dia.mjs --fecha=2026-06-08
 *   node scripts/inspect-intercambio-dia.mjs --fecha=2026-06-08 --persona=per_...
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildAsiDocumentId, buildVisDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { resolverCapaTeoricaGrupo } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"),
);
const { fusionarDiasDesdeClavesPlanas } = require(
  join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
);

const GDT_DEFAULT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const CHAPARRO = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";

function loadGac() {
  for (const line of readFileSync(join(repoRoot, ".env.v2.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      return t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function parseArgs() {
  let fecha = "2026-06-08";
  let gdt = GDT_DEFAULT;
  /** @type {Array<{ label: string, id: string }>} */
  const personas = [
    { label: "LOKITO", id: LOKITO },
    { label: "CHAPARRO", id: CHAPARRO },
  ];
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--fecha=")) fecha = a.slice(8).trim();
    if (a.startsWith("--gdt=")) gdt = a.slice(6).trim();
    if (a.startsWith("--persona=")) {
      const id = a.slice(10).trim();
      personas.length = 0;
      personas.push({ label: id.slice(0, 12), id });
    }
  }
  return { fecha, gdt, personas };
}

/** @param {unknown} ov */
function resumenOverride(ov) {
  if (!ov || typeof ov !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (ov);
  if (o.eliminado || o.invalidado_por_replanificacion) return null;
  return {
    tipo: o.tipo,
    schema_version: o.schema_version,
    gdt: o.grupo_de_trabajo_id,
    orig: o.persona_origen_id,
    cob: o.persona_cobertura_id,
    fo: o.fecha_origen || o.fecha,
    fd: o.fecha_destino,
    segs_orig: o.segmentos_cedidos_origen || o.segmentos_cubiertos,
    segs_dest: o.segmentos_cedidos_destino,
    leg: o.reemplazo_traslado_v2,
    turno_id: o.turno_id,
    segs_tras: o.segmentos_a_trasladar || o.segmentos_trasladar,
    segs_inc_dest: o.segmentos_incorporados_destino,
  };
}

/** @param {Record<string, unknown>|null|undefined} capa @param {string} pid */
function resumenCapa(capa, pid) {
  const segs = Array.isArray(capa?.segmentos) ? capa.segmentos : [];
  return {
    tipo_dia: capa?.tipo_dia ?? null,
    turno_compuesto_id: capa?.turno_compuesto_id ?? null,
    fichadas_esperadas: capa?.fichadas_esperadas ?? null,
    segmentos: segs.map((s) => ({
      id: s.segmento_id,
      titular: s.persona_titular_id,
      ejecutante: s.persona_ejecutante_id,
      origen: s.origen_segmento,
      propio: s.persona_titular_id === pid && s.persona_ejecutante_id === pid,
    })),
  };
}

function resumenVisCelda(celda) {
  if (!celda || typeof celda !== "object") return null;
  const pres = celda.presentacion_compuesto;
  const filas = Array.isArray(pres?.filas) ? pres.filas : [];
  return {
    rda_turno_id: celda.rda_turno_id ?? null,
    rda_ingreso: celda.rda_ingreso ?? null,
    rda_egreso: celda.rda_egreso ?? null,
    fichadas_esperadas: celda.fichadas_esperadas ?? null,
    fichadas_reales: celda.fichadas_reales ?? null,
    presentacion_filas: filas.map((f) => ({
      seg: f.segmento_id,
      badge: f.badge_label,
      estado: f.estado_tramo,
      fichada: f.fichada_label,
    })),
    analitica_segs: Array.isArray(celda.analitica_cumplimiento?.segmentos_cumplimiento)
      ? celda.analitica_cumplimiento.segmentos_cumplimiento.map((s) => s.segmento_id)
      : null,
    rda_tiene_huecos: celda.rda_tiene_huecos ?? null,
    claves_planas_d08: Object.keys(celda).filter((k) => /^d\d{2}_/.test(k) || k.includes("08")),
  };
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}
const db = getFirestore();
const { fecha, gdt, personas } = parseArgs();
const dk = fecha.slice(8, 10);
const periodo = fecha.slice(0, 7);

console.log(`Inspección intercambio · ${fecha} · GDT ${gdt}\n`);

for (const { label, id: pid } of personas) {
  const asiId = buildAsiDocumentId(pid, fecha);
  const asiSnap = await db.collection("asistencia_diaria").doc(asiId).get();
  const asi = asiSnap.exists ? asiSnap.data() : null;
  const capa = asi ? resolverCapaTeoricaGrupo(asi, gdt) : null;
  const ovs = Array.isArray(asi?.overrides_turno) ? asi.overrides_turno : [];
  const activos = ovs.map(resumenOverride).filter(Boolean);
  const visId = buildVisDocumentId(pid, `${periodo}-01`, gdt);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const rawVis = visSnap.exists ? visSnap.data() : null;
  const dias = fusionarDiasDesdeClavesPlanas(rawVis || {});
  const celda = dias[dk] || {};

  console.log("═".repeat(72));
  console.log(`${label} · ${pid}`);
  console.log(`asi: ${asiId} exists=${asiSnap.exists}`);
  console.log(`vis: ${visId} exists=${visSnap.exists}`);
  console.log("\n--- overrides activos (resumen) ---");
  console.log(JSON.stringify(activos, null, 2));
  console.log("\n--- capa_teorica_por_grupo[gdt] ---");
  console.log(JSON.stringify(resumenCapa(capa, pid), null, 2));
  console.log("\n--- vis celda fusionada ---");
  console.log(JSON.stringify(resumenVisCelda(celda), null, 2));
  console.log("");
}
