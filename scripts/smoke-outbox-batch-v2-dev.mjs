/**
 * Smoke A-BATCH / B-BATCH-1 contra Firestore dev (callable in-process).
 *
 *   node scripts/smoke-outbox-batch-v2-dev.mjs
 *   node scripts/smoke-outbox-batch-v2-dev.mjs --solo=a|b|c|abc
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildAsiDocumentId, buildVisDocumentId } = require("../functions/modules/shared/mdcRdaDocumentIds.js");
const { aplicarBatchAsistencia } = require("../functions/modules/asistencia/cambiosTurno.js");
const {
  CFG_EPL_ABIERTO,
  CFG_TCC_CAMBIO_INTERNO,
} = require("../functions/modules/shared/cfgAsistenciaTurnosIds.js");

const TAG = "[smoke-outbox-batch-v2-dev]";

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function visToken(data) {
  const meta = data?.metadata || {};
  return tsToIso(meta.version_token) || tsToIso(meta.ultima_sync_teorica);
}

function arg(name, fallback = "") {
  const key = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(key));
  return hit ? hit.slice(key.length) : fallback;
}

async function initDb() {
  const env = readFileSync(".env.v2.local", "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("GOOGLE_APPLICATION_CREDENTIALS="));
  const gac = (env?.split("=")[1] || "").trim().replace(/^["']|["']$/g, "");
  if (!gac || !existsSync(gac)) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  const sa = JSON.parse(readFileSync(gac, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
  return getFirestore();
}

async function resolverGdt(db, personaId, fecha, gdtArg) {
  const explicit = String(gdtArg || "").trim();
  if (/^gdt_/i.test(explicit)) return explicit;
  const snap = await db.collection("historial_laboral_grupos")
    .where("persona_id", "==", personaId)
    .where("activo", "==", true)
    .get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const fi = d.fecha_inicio || "";
    const ff = d.fecha_fin || "";
    if (fi && fi > fecha) continue;
    if (ff && ff < fecha) continue;
    const gdt = String(d.grupo_de_trabajo_id || "").trim();
    if (/^gdt_/i.test(gdt)) return gdt;
  }
  throw new Error("No se pudo resolver gdt. Pasá --gdt=gdt_*.");
}

async function ensureVisAbierto(visRef, prevHolder) {
  const snap = await visRef.get();
  prevHolder.val = snap.exists ? (snap.data()?.estado_periodo_liquidacion_id ?? null) : null;
  await visRef.set({ estado_periodo_liquidacion_id: CFG_EPL_ABIERTO }, { merge: true });
}

async function readToken(db, personaId, fecha, gdt) {
  const visId = buildVisDocumentId(personaId, fecha, gdt);
  const snap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const t = visToken(snap.data());
  if (!t) throw new Error(`Sin token vis para ${personaId} ${fecha}`);
  return t;
}

function countV2Overrides(snap) {
  const all = Array.isArray(snap.data()?.overrides_turno) ? snap.data().overrides_turno : [];
  return all.filter((o) => o.schema_version === 2 && !o.eliminado).length;
}

async function smokeA({ db, auth, gdt, perA, perB, fOrig, fDest, segA, segB }) {
  const prev = {};
  const visA = db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(perA, fOrig, gdt));
  const visB = db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(perB, fDest, gdt));
  await Promise.all([
    ensureVisAbierto(visA, { val: null }).then(() => { prev.a = null; }),
    ensureVisAbierto(visB, { val: null }).then(() => { prev.b = null; }),
  ]);
  const [tokA, tokB] = await Promise.all([
    readToken(db, perA, fOrig, gdt),
    readToken(db, perB, fDest, gdt),
  ]);

  const asiA = db.collection("asistencia_diaria").doc(buildAsiDocumentId(perA, fOrig));
  const asiB = db.collection("asistencia_diaria").doc(buildAsiDocumentId(perB, fDest));
  const [beforeA, beforeB] = await Promise.all([asiA.get(), asiB.get()]);
  const baseA = countV2Overrides(beforeA);
  const baseB = countV2Overrides(beforeB);

  const op = {
    id: `smoke_a_v2_${Date.now()}`,
    tipo: "cobertura_parcial",
    concurrencia: {
      expected_version_token: tokA,
      expected_version_token_destino: tokB,
    },
    context: { grupo_id: gdt, periodo: fOrig.slice(0, 7) },
    payload: {
      origen: { persona_id: perA, fecha: fOrig, segmentos_cedidos: [segA] },
      destino: { persona_id: perB, fecha: fDest, segmentos_cedidos: [segB] },
      tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
      motivo: "Smoke A-BATCH v2 intercambio",
      tipo: "cobertura_parcial",
    },
  };

  const res = await aplicarBatchAsistencia.run({ data: { periodo: fOrig.slice(0, 7), ops: [op] }, auth });
  const [afterA, afterB] = await Promise.all([asiA.get(), asiB.get()]);
  if (countV2Overrides(afterA) < baseA + 1) {
    throw new Error(`A: falta override v2 en asi origen ${perA} ${fOrig}`);
  }
  if (countV2Overrides(afterB) < baseB + 1) {
    throw new Error(`A: falta override v2 en asi destino ${perB} ${fDest}`);
  }
  console.log(`${TAG} ✅ A-BATCH v2 aplicadas=${res?.aplicadas ?? "?"}`);
  return { tokA, tokB, fOrig, fDest, perA, perB };
}

async function smokeB({ db, auth, gdt, per, fOrig, fDest, seg, turnoDest }) {
  const visOrig = db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(per, fOrig, gdt));
  const visDest = db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(per, fDest, gdt));
  await Promise.all([
    ensureVisAbierto(visOrig, {}),
    ensureVisAbierto(visDest, {}),
  ]);
  const [tokOrig, tokDest] = await Promise.all([
    readToken(db, per, fOrig, gdt),
    readToken(db, per, fDest, gdt),
  ]);

  const asiOrig = db.collection("asistencia_diaria").doc(buildAsiDocumentId(per, fOrig));
  const asiDest = db.collection("asistencia_diaria").doc(buildAsiDocumentId(per, fDest));
  const [beforeOrig, beforeDest] = await Promise.all([asiOrig.get(), asiDest.get()]);
  const nOrig = Array.isArray(beforeOrig.data()?.overrides_turno) ? beforeOrig.data().overrides_turno.length : 0;
  const nDest = Array.isArray(beforeDest.data()?.overrides_turno) ? beforeDest.data().overrides_turno.length : 0;

  const op = {
    id: `smoke_b_v2_${Date.now()}`,
    tipo: "reemplazo",
    concurrencia: {
      expected_version_token: tokDest,
      expected_version_token_origen: tokOrig,
    },
    context: { grupo_id: gdt, periodo: fOrig.slice(0, 7) },
    payload: {
      persona_id: per,
      fecha: fDest,
      fecha_origen: fOrig,
      fecha_destino: fDest,
      segmentos_a_trasladar: [seg],
      segmentos_incorporados_destino: [turnoDest],
      turno_id: turnoDest,
      franco_en_origen: false,
      motivo: "Smoke B-BATCH v2 traslado",
      tipo: "reemplazo",
    },
  };

  const res = await aplicarBatchAsistencia.run({ data: { periodo: fOrig.slice(0, 7), ops: [op] }, auth });
  const [afterOrig, afterDest] = await Promise.all([asiOrig.get(), asiDest.get()]);
  const nOrig2 = Array.isArray(afterOrig.data()?.overrides_turno) ? afterOrig.data().overrides_turno.length : 0;
  const nDest2 = Array.isArray(afterDest.data()?.overrides_turno) ? afterDest.data().overrides_turno.length : 0;
  if (nOrig2 < nOrig + 1 || nDest2 < nDest + 1) {
    throw new Error(`B: overrides esperados +1 en origen y destino. ${nOrig}->${nOrig2}, ${nDest}->${nDest2}`);
  }
  const lastOrig = (afterOrig.data()?.overrides_turno || []).slice(-1)[0];
  const lastDest = (afterDest.data()?.overrides_turno || []).slice(-1)[0];
  if (lastOrig?.reemplazo_traslado_v2 !== "origen" || lastDest?.reemplazo_traslado_v2 !== "destino") {
    throw new Error("B: override sin reemplazo_traslado_v2 origen/destino");
  }
  console.log(`${TAG} ✅ B-BATCH-1 aplicadas=${res?.aplicadas ?? "?"}`);
}

async function smokeC({ db, auth, gdt, per, fecha, turnoAdicional, turnoPre }) {
  const visRef = db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(per, fecha, gdt));
  await ensureVisAbierto(visRef, {});
  const tok = await readToken(db, per, fecha, gdt);

  const asiRef = db.collection("asistencia_diaria").doc(buildAsiDocumentId(per, fecha));
  const before = await asiRef.get();
  const nBefore = Array.isArray(before.data()?.overrides_turno) ? before.data().overrides_turno.length : 0;

  const op = {
    id: `smoke_c_v2_${Date.now()}`,
    tipo: "adicional",
    concurrencia: { expected_version_token: tok },
    context: { grupo_id: gdt, periodo: fecha.slice(0, 7) },
    payload: {
      persona_id: per,
      fecha,
      tipo: "adicional",
      turno_id: turnoAdicional,
      turno_id_adicional: turnoAdicional,
      motivo: "Smoke C-BATCH v2 adicional",
      estado_previo: {
        es_franco: false,
        es_feriado: false,
        es_no_laborable: false,
        turno_preasignado_id: turnoPre,
        horas_preasignadas: 8,
        etiqueta_preasignada: "M",
      },
    },
  };

  const res = await aplicarBatchAsistencia.run({ data: { periodo: fecha.slice(0, 7), ops: [op] }, auth });
  const after = await asiRef.get();
  const nAfter = Array.isArray(after.data()?.overrides_turno) ? after.data().overrides_turno.length : 0;
  if (nAfter < nBefore + 1) throw new Error("C: falta override adicional en asi");
  const last = (after.data()?.overrides_turno || []).slice(-1)[0];
  if (!last?.estado_previo || last.tipo !== "adicional") {
    throw new Error("C: override sin estado_previo o tipo adicional");
  }
  console.log(`${TAG} ✅ C-BATCH aplicadas=${res?.aplicadas ?? "?"}`);
}

async function main() {
  const solo = arg("solo", "abc").toLowerCase();
  const db = await initDb();
  const perA = arg("persona-origen", "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ");
  const perB = arg("persona-cobertura", "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB");
  const fOrigA = arg("fecha-origen", "2026-06-05");
  const fDestA = arg("fecha-destino", "2026-06-12");
  const segA = arg("segmento-origen", "cfg_reg_turno_n");
  const segB = arg("segmento-destino", "cfg_reg_turno_m");
  const fOrigB = arg("fecha-origen-b", "2026-06-08");
  const fDestB = arg("fecha-destino-b", "2026-06-15");
  const segBtras = arg("segmento-trasladar", segA);
  const turnoDest = arg("turno-destino", segB);
  const fC = arg("fecha-c", "2026-06-18");
  const turnoC = arg("turno-adicional", segB);
  const turnoPreC = arg("turno-preasignado", segA);
  const gdt = await resolverGdt(db, perA, fOrigA, arg("gdt", ""));

  const auth = { uid: "smoke-outbox-v2", token: { persona_id: perA } };

  if (solo.includes("a")) {
    await smokeA({ db, auth, gdt, perA, perB, fOrig: fOrigA, fDest: fDestA, segA, segB });
  }
  if (solo.includes("b")) {
    await smokeB({
      db, auth, gdt, per: perA, fOrig: fOrigB, fDest: fDestB, seg: segBtras, turnoDest,
    });
  }
  if (solo.includes("c")) {
    await smokeC({
      db, auth, gdt, per: perA, fecha: fC, turnoAdicional: turnoC, turnoPre: turnoPreC,
    });
  }

  console.log(`${TAG} ✅ smoke v2 completo (solo=${solo})`);
}

main().catch((e) => {
  console.error(`${TAG} ❌ FAIL`, e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
