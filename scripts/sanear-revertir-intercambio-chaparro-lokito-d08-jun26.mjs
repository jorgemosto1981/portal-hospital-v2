/**
 * Revierte intercambios de guardia (cobertura_parcial v2) del 08-jun-2026 entre
 * CHAPARRO y LOKITO en Sala Internación 1.
 *
 *   node scripts/sanear-revertir-intercambio-chaparro-lokito-d08-jun26.mjs
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-revertir-intercambio-chaparro-lokito-d08-jun26.mjs --apply
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
if (APPLY) {
  assertFirestoreSeedAllowed("sanear-revertir-intercambio-chaparro-lokito-d08-jun26");
}

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
const { materializarTurnoTeoricoDia } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);
const { leerVistaGrillaMesAgente } = require(
  join(repoRoot, "functions/modules/shared/grillaMesAgenteCore.js"),
);

const FECHA = "2026-06-08";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const CHAPARRO = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";
const PERSONAS = [
  { label: "LOKITO", id: LOKITO },
  { label: "CHAPARRO", id: CHAPARRO },
];
const SANACION_TAG = "sanear-revertir-intercambio-chaparro-lokito-d08-jun26";

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

/** @param {Record<string, unknown>} ov */
function esIntercambioObjetivo(ov) {
  if (!ov || typeof ov !== "object") return false;
  if (ov.tipo !== "cobertura_parcial") return false;
  if (ov.invalidado_por_replanificacion === true || ov.eliminado === true) return false;
  if (String(ov.grupo_de_trabajo_id || "").trim() !== GDT) return false;
  const par = new Set([LOKITO, CHAPARRO]);
  const orig = String(ov.persona_origen_id || "").trim();
  const cob = String(ov.persona_cobertura_id || "").trim();
  if (!par.has(orig) || !par.has(cob) || orig === cob) return false;
  const fo = String(ov.fecha_origen || ov.fecha || "").trim().slice(0, 10);
  const fd = String(ov.fecha_destino || ov.fecha || "").trim().slice(0, 10);
  return fo === FECHA && fd === FECHA;
}

/** @param {Array<Record<string, unknown>>} overrides */
function invalidarOverridesObjetivo(overrides) {
  const list = Array.isArray(overrides) ? overrides : [];
  let tocados = 0;
  const next = list.map((ov) => {
    if (!esIntercambioObjetivo(ov)) return ov;
    tocados += 1;
    return {
      ...ov,
      invalidado_por_replanificacion: true,
      invalidado_en: new Date().toISOString(),
      invalidado_por_sanacion: SANACION_TAG,
    };
  });
  return { next, tocados };
}

/** @param {Record<string, unknown>|null|undefined} capa @param {string} pid */
function resumenCapa(capa, pid) {
  const segs = Array.isArray(capa?.segmentos) ? capa.segmentos : [];
  return {
    turno_compuesto_id: capa?.turno_compuesto_id ?? null,
    fichadas_esperadas: capa?.fichadas_esperadas ?? null,
    segmentos: segs.map((s) => ({
      id: s.segmento_id,
      titular: s.persona_titular_id,
      ejecutante: s.persona_ejecutante_id,
      propio: s.persona_titular_id === pid && s.persona_ejecutante_id === pid,
    })),
  };
}

/** @param {import("firebase-admin/firestore").Firestore} db @param {string} pid */
async function leerEstado(db, pid) {
  const asiId = buildAsiDocumentId(pid, FECHA);
  const asiSnap = await db.collection("asistencia_diaria").doc(asiId).get();
  const asi = asiSnap.exists ? asiSnap.data() : null;
  const capa = asi ? resolverCapaTeoricaGrupo(asi, GDT) : null;
  const visId = buildVisDocumentId(pid, `${FECHA.slice(0, 7)}-01`, GDT);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const dias = fusionarDiasDesdeClavesPlanas(visSnap.data() || {});
  const celda = dias[FECHA.slice(8, 10)] || {};
  const activos = (asi?.overrides_turno || []).filter((o) => esIntercambioObjetivo(o));
  return {
    asiId,
    capa: resumenCapa(capa, pid),
    vis: {
      rda_turno_id: celda.rda_turno_id ?? null,
      rda_ingreso: celda.rda_ingreso ?? null,
      rda_egreso: celda.rda_egreso ?? null,
      fichadas_esperadas: celda.fichadas_esperadas ?? null,
    },
    overrides_activos_intercambio: activos.length,
  };
}

/** @param {ReturnType<typeof resumenCapa>} capa @param {string[]} tokens */
function validarTramosPropios(capa, tokens) {
  const propios = (capa.segmentos || []).filter((s) => s.propio);
  const ids = new Set(propios.map((s) => String(s.id)));
  for (const t of tokens) {
    if (!ids.has(t)) {
      return { ok: false, error: `falta tramo propio ${t}` };
    }
  }
  const ajenos = (capa.segmentos || []).filter((s) => !s.propio);
  if (ajenos.some((s) => s.ejecutante !== s.titular)) {
    return { ok: false, error: "quedan tramos cedidos a otro agente" };
  }
  if ((capa.fichadas_esperadas ?? 0) < 1) {
    return { ok: false, error: "fichadas_esperadas < 1" };
  }
  return { ok: true, turno: capa.turno_compuesto_id, propios: propios.length };
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const db = getFirestore();

console.log(`Modo: ${APPLY ? "APPLY (escritura)" : "DRY-RUN"}`);
console.log(`Fecha: ${FECHA} · Grupo: ${GDT}\n`);

console.log("--- Estado ANTES ---");
const antes = {};
for (const { label, id } of PERSONAS) {
  antes[id] = await leerEstado(db, id);
  console.log(label, JSON.stringify(antes[id], null, 2));
}

const planInvalidacion = [];
for (const { label, id } of PERSONAS) {
  const asiId = buildAsiDocumentId(id, FECHA);
  const snap = await db.collection("asistencia_diaria").doc(asiId).get();
  const overrides = snap.exists ? snap.data()?.overrides_turno : [];
  const { tocados } = invalidarOverridesObjetivo(overrides || []);
  planInvalidacion.push({ label, id, asiId, tocados });
}

console.log("\n--- Plan invalidación overrides cobertura_parcial v2 ---");
for (const row of planInvalidacion) {
  console.log(`${row.label}: ${row.tocados} override(s) en ${row.asiId}`);
}
const totalInvalidar = planInvalidacion.reduce((n, r) => n + r.tocados, 0);
if (totalInvalidar < 1) {
  console.error("\nFAIL: no hay overrides activos de intercambio para revertir.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDry-run OK. Para aplicar:");
  console.log(
    "  ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-revertir-intercambio-chaparro-lokito-d08-jun26.mjs --apply",
  );
  process.exit(0);
}

console.log("\n--- Aplicando invalidación ---");
for (const { label, id, asiId } of planInvalidacion) {
  const ref = db.collection("asistencia_diaria").doc(asiId);
  const snap = await ref.get();
  const { next, tocados } = invalidarOverridesObjetivo(snap.data()?.overrides_turno || []);
  if (!tocados) continue;
  await ref.update({
    overrides_turno: next,
    actualizado_en: FieldValue.serverTimestamp(),
  });
  console.log(`${label}: invalidados ${tocados} override(s)`);
}

console.log("\n--- Rematerializando ---");
for (const { label, id } of PERSONAS) {
  const mat = await materializarTurnoTeoricoDia({
    personaId: id,
    grupoId: GDT,
    fechaYmd: FECHA,
  });
  console.log(`${label}:`, {
    ok: mat.ok,
    turno_compuesto_id: mat.turno_compuesto_id,
    segmentos: mat.segmentos,
    fichadas_esperadas: mat.fichadas_esperadas,
    error: mat.error || null,
  });
  if (!mat.ok) {
    console.error(`FAIL materializar ${label}`);
    process.exit(1);
  }
}

console.log("\n--- Estado DESPUÉS ---");
const despues = {};
for (const { label, id } of PERSONAS) {
  despues[id] = await leerEstado(db, id);
  console.log(label, JSON.stringify(despues[id], null, 2));
}

const valLokito = validarTramosPropios(despues[LOKITO].capa, ["M", "T"]);
const valChaparro = validarTramosPropios(despues[CHAPARRO].capa, ["M", "N"]);

console.log("\n--- Validación (plan piloto jun-26) ---");
console.log("LOKITO M+T:", valLokito);
console.log("CHAPARRO M+N:", valChaparro);

if (!valLokito.ok || !valChaparro.ok) {
  console.error("\nWARN: estado post-sanación distinto al plan M+T / M+N; revisar manualmente.");
  process.exit(1);
}

const dk = FECHA.slice(8, 10);
for (const { label, id } of PERSONAS) {
  const vista = await leerVistaGrillaMesAgente(db, {
    personaId: id,
    grupoTrabajoId: GDT,
    anio: 2026,
    mes: 6,
  });
  const celda = vista?.dias?.[dk] || {};
  console.log(`VIS ${label} d${dk}:`, {
    rda_turno_id: celda.rda_turno_id,
    rda_ingreso: celda.rda_ingreso,
    rda_egreso: celda.rda_egreso,
    fichadas_esperadas: celda.fichadas_esperadas,
  });
}

console.log("\nPASS: overrides d8 LOKITO↔CHAPARRO invalidados; teoría/vis rematerializados.");
