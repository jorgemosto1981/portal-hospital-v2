/**
 * Revierte el intercambio de guardia (cobertura_parcial v2) del 17-jun-2026 entre
 * CAMPOS JAQUELINA y LOKITO en Sala Internación 1.
 *
 * Acción:
 *  1. Marca `invalidado_por_replanificacion` en overrides cobertura_parcial v2 del día.
 *  2. Rematerializa teoría + vis_* de ambos agentes (no toca el traslado M d16→d17 de LOKITO).
 *
 * Uso:
 *   node scripts/sanear-revertir-intercambio-campos-lokito-d17-jun26.mjs          # dry-run
 *   ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-revertir-intercambio-campos-lokito-d17-jun26.mjs --apply
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
  assertFirestoreSeedAllowed("sanear-revertir-intercambio-campos-lokito-d17-jun26");
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

const FECHA = "2026-06-17";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const CAMPOS = "per_01KR3GZX9TB33NHTE2QD5ZP13V";
const PERSONAS = [
  { label: "LOKITO", id: LOKITO },
  { label: "CAMPOS", id: CAMPOS },
];
const SANACION_TAG = "sanear-revertir-intercambio-campos-lokito-d17-jun26";

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
  const par = new Set([LOKITO, CAMPOS]);
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
  const activos = (asi?.overrides_turno || []).filter(
    (o) => esIntercambioObjetivo(o),
  );
  return {
    asiId,
    capa: resumenCapa(capa, pid),
    vis: {
      rda_turno_id: celda.rda_turno_id ?? null,
      fichadas_esperadas: celda.fichadas_esperadas ?? null,
    },
    overrides_activos_intercambio: activos.length,
  };
}

/** @param {ReturnType<typeof resumenCapa>} capa @param {string} pid @param {{ soloN?: boolean }} [opts] */
function validarCapaRevertida(capa, pid, opts = {}) {
  const propios = (capa.segmentos || []).filter((s) => s.propio);
  if (!propios.length) return { ok: false, error: "sin tramos propios" };
  if ((capa.fichadas_esperadas ?? 0) < 1) return { ok: false, error: "fichadas_esperadas < 1" };
  if (opts.soloN && propios.length !== 1) {
    return { ok: false, error: `se esperaba 1 tramo propio (N), hay ${propios.length}` };
  }
  if (opts.soloN && !propios.some((s) => String(s.id) === "N")) {
    return { ok: false, error: "falta tramo N propio" };
  }
  const ajenos = (capa.segmentos || []).filter((s) => !s.propio);
  if (ajenos.some((s) => s.ejecutante !== s.titular)) {
    return { ok: false, error: "quedan tramos cedidos a otro agente" };
  }
  return { ok: true, propios: propios.length };
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
    "  ALLOW_FIRESTORE_SEED_V2=true node scripts/sanear-revertir-intercambio-campos-lokito-d17-jun26.mjs --apply",
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
    tipo_dia: mat.tipo_dia,
    segmentos: mat.segmentos,
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

const valCampos = validarCapaRevertida(despues[CAMPOS].capa, CAMPOS, { soloN: true });
const valLokito = validarCapaRevertida(despues[LOKITO].capa, LOKITO);

console.log("\n--- Validación ---");
console.log("CAMPOS:", valCampos);
console.log("LOKITO:", valLokito);

if (!valCampos.ok || !valLokito.ok) {
  console.error("\nFAIL: estado post-sanación no cumple expectativa.");
  process.exit(1);
}

const vistaCampos = await leerVistaGrillaMesAgente(db, {
  personaId: CAMPOS,
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
});
const vistaLokito = await leerVistaGrillaMesAgente(db, {
  personaId: LOKITO,
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
});
console.log("\n--- VIS día 17 ---");
console.log("CAMPOS:", {
  rda_turno_id: vistaCampos?.dias?.["17"]?.rda_turno_id,
  fichadas_esperadas: vistaCampos?.dias?.["17"]?.fichadas_esperadas,
});
console.log("LOKITO:", {
  rda_turno_id: vistaLokito?.dias?.["17"]?.rda_turno_id,
  fichadas_esperadas: vistaLokito?.dias?.["17"]?.fichadas_esperadas,
});

if ((vistaCampos?.dias?.["17"]?.fichadas_esperadas ?? 0) < 1) {
  console.error("\nFAIL: CAMPOS vis fichadas_esperadas sigue en 0.");
  process.exit(1);
}

console.log("\nPASS: intercambio d17 revertido; CAMPOS N propia y LOKITO con tramos propios.");
