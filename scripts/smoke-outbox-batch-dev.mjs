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
  CFG_TOV_COBERTURA_PARCIAL,
} = require("../functions/modules/shared/cfgAsistenciaTurnosIds.js");

const TAG = "[smoke-outbox-batch-dev]";

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

function mkOp({ id, personaOrigen, personaCobertura, fecha, segmento, token, motivo, gdt }) {
  return {
    id,
    tipo: "cobertura_parcial",
    creado_en: new Date().toISOString(),
    payload: {
      persona_origen_id: personaOrigen,
      persona_cobertura_id: personaCobertura,
      fecha,
      segmentos_cubiertos: [segmento],
      tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
      tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
      tipo: "cobertura_parcial",
      motivo,
    },
    concurrencia: {
      expected_version_token: token,
    },
    context: {
      grupo_id: gdt,
      periodo: fecha.slice(0, 7),
    },
  };
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

async function main() {
  const db = await initDb();
  const personaOrigen = arg("persona-origen", "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ");
  const personaCobertura = arg("persona-cobertura", "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB");
  const fecha = arg("fecha", "2026-06-10");
  const segmento = arg("segmento", "cfg_reg_turno_01_manana");
  const gdt = await resolverGdt(db, personaOrigen, fecha, arg("gdt", ""));

  const visId = buildVisDocumentId(personaOrigen, fecha, gdt);
  const visRef = db.collection("vistas_grilla_mes_agente").doc(visId);
  const visCobId = buildVisDocumentId(personaCobertura, fecha, gdt);
  const visCobRef = db.collection("vistas_grilla_mes_agente").doc(visCobId);
  const asiId = buildAsiDocumentId(personaOrigen, fecha);
  const asiRef = db.collection("asistencia_diaria").doc(asiId);

  const [visBefore, visCobBefore] = await Promise.all([visRef.get(), visCobRef.get()]);
  const tokenA = visToken(visBefore.data());
  if (!tokenA) throw new Error("No se pudo leer tokenA de vis_*.");
  const prevEstadoX = visBefore.exists ? (visBefore.data()?.estado_periodo_liquidacion_id ?? null) : null;
  const prevEstadoY = visCobBefore.exists ? (visCobBefore.data()?.estado_periodo_liquidacion_id ?? null) : null;
  await Promise.all([
    visRef.set({ estado_periodo_liquidacion_id: CFG_EPL_ABIERTO }, { merge: true }),
    visCobRef.set({ estado_periodo_liquidacion_id: CFG_EPL_ABIERTO }, { merge: true }),
  ]);
  const asiBefore = await asiRef.get();
  const baseCount = Array.isArray(asiBefore.data()?.overrides_turno) ? asiBefore.data().overrides_turno.length : 0;

  const opsOk = Array.from({ length: 3 }, (_, i) =>
    mkOp({
      id: `ok_${i + 1}`,
      personaOrigen,
      personaCobertura,
      fecha,
      segmento,
      token: tokenA,
      motivo: `Smoke outbox success #${i + 1}`,
      gdt,
    }));

  const auth = { uid: "smoke-outbox", token: { persona_id: personaOrigen } };
  try {
    const batchOk = await aplicarBatchAsistencia.run({ data: { periodo: fecha.slice(0, 7), ops: opsOk }, auth });
    const asiAfterOk = await asiRef.get();
    const countAfterOk = Array.isArray(asiAfterOk.data()?.overrides_turno) ? asiAfterOk.data().overrides_turno.length : 0;
    if (countAfterOk !== baseCount + 3) {
      throw new Error(`Esperaba +3 overrides tras éxito. before=${baseCount}, after=${countAfterOk}`);
    }

    const visAfterOk = await visRef.get();
    const tokenB = visToken(visAfterOk.data());
    if (!tokenB || tokenB === tokenA) {
      throw new Error("No cambió token de versión tras batch exitoso.");
    }

    const opsRollback = [];
    for (let i = 0; i < 10; i++) {
      opsRollback.push(
        mkOp({
          id: `rb_ok_${i + 1}`,
          personaOrigen,
          personaCobertura,
          fecha,
          segmento,
          token: tokenB,
          motivo: `Smoke outbox rollback valid #${i + 1}`,
          gdt,
        }),
      );
    }
    opsRollback.push(
      mkOp({
        id: "rb_stale",
        personaOrigen,
        personaCobertura,
        fecha,
        segmento,
        token: tokenA,
        motivo: "Smoke outbox rollback stale token",
        gdt,
      }),
    );

    let failMsg = "";
    try {
      await aplicarBatchAsistencia.run({ data: { periodo: fecha.slice(0, 7), ops: opsRollback }, auth });
    } catch (e) {
      failMsg = e?.message || String(e);
    }
    if (!failMsg.includes("ASI-CONC-001")) {
      throw new Error(`Rollback esperado por concurrencia no ocurrió. msg=${failMsg}`);
    }

    const asiAfterRb = await asiRef.get();
    const countAfterRb = Array.isArray(asiAfterRb.data()?.overrides_turno) ? asiAfterRb.data().overrides_turno.length : 0;
    if (countAfterRb !== countAfterOk) {
      throw new Error(`Rollback falló: cambió cantidad de overrides. expected=${countAfterOk}, got=${countAfterRb}`);
    }

    console.log(`${TAG} ✅ éxito batch aplicadas=${batchOk?.aplicadas || 0}`);
    console.log(`${TAG} ✅ rollback atómico validado (10 válidas + 1 stale)`);
    console.log(JSON.stringify({
      persona_origen: personaOrigen,
      persona_cobertura: personaCobertura,
      grupo_trabajo_id: gdt,
      fecha,
      tokenA,
      tokenB,
      overrides_before: baseCount,
      overrides_after_success: countAfterOk,
      overrides_after_rollback: countAfterRb,
      rollback_error: failMsg,
    }, null, 2));
  } finally {
    await Promise.all([
      visRef.set({ estado_periodo_liquidacion_id: prevEstadoX || CFG_EPL_ABIERTO }, { merge: true }),
      visCobRef.set({ estado_periodo_liquidacion_id: prevEstadoY || CFG_EPL_ABIERTO }, { merge: true }),
    ]);
  }
}

main().catch((e) => {
  console.error(`${TAG} ❌ FAIL`, e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
