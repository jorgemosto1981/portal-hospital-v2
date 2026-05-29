import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require("../functions/modules/shared/mdcRdaDocumentIds.js");
const { aplicarBatchAsistencia } = require("../functions/modules/asistencia/cambiosTurno.js");
const {
  CFG_EPL_LIQUIDADO_CERRADO,
  CFG_TCC_CAMBIO_INTERNO,
  CFG_TOV_COBERTURA_PARCIAL,
} = require("../functions/modules/shared/cfgAsistenciaTurnosIds.js");

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

async function initDb() {
  const line = readFileSync(".env.v2.local", "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("GOOGLE_APPLICATION_CREDENTIALS="));
  const gac = (line?.split("=")[1] || "").trim().replace(/^["']|["']$/g, "");
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

function arg(name, fallback = "") {
  const key = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(key));
  return hit ? hit.slice(key.length) : fallback;
}

async function main() {
  const db = await initDb();
  const personaOrigen = arg("persona-origen", "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ");
  const personaCobertura = arg("persona-cobertura", "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB");
  const fecha = arg("fecha", "2026-06-10");
  const segmento = arg("segmento", "cfg_reg_turno_01_manana");
  const gdt = await resolverGdt(db, personaOrigen, fecha, arg("gdt", ""));

  const visOrigenId = buildVisDocumentId(personaOrigen, fecha, gdt);
  const visCobId = buildVisDocumentId(personaCobertura, fecha, gdt);
  const visOrigenRef = db.collection("vistas_grilla_mes_agente").doc(visOrigenId);
  const visCobRef = db.collection("vistas_grilla_mes_agente").doc(visCobId);

  const [snapOrigen, snapCob] = await Promise.all([visOrigenRef.get(), visCobRef.get()]);
  const token = visToken(snapOrigen.data());
  const prevCobEstado = snapCob.exists ? (snapCob.data()?.estado_periodo_liquidacion_id ?? null) : null;
  if (!token) throw new Error("No se pudo obtener token de versión para el origen.");

  await visCobRef.set({ estado_periodo_liquidacion_id: CFG_EPL_LIQUIDADO_CERRADO }, { merge: true });

  const op = {
    id: "freeze_case_1",
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
      motivo: "Smoke freeze batch",
    },
    concurrencia: {
      expected_version_token: token,
    },
    context: {
      grupo_id: gdt,
      periodo: fecha.slice(0, 7),
    },
  };

  let failMsg = "";
  try {
    await aplicarBatchAsistencia.run({
      data: {
        periodo: fecha.slice(0, 7),
        ops: [op],
      },
      auth: { uid: "smoke-freeze-batch", token: { persona_id: personaOrigen } },
    });
  } catch (e) {
    failMsg = e?.message || String(e);
  } finally {
    await visCobRef.set({ estado_periodo_liquidacion_id: prevCobEstado }, { merge: true });
  }

  const ok = failMsg.includes("ASI-PER-001");
  console.log(JSON.stringify({ ok, failMsg, visCobId, prevCobEstado }, null, 2));
  if (!ok) throw new Error(`Se esperaba rechazo ASI-PER-001. msg=${failMsg}`);
}

main().catch((e) => {
  console.error("[smoke-outbox-freeze-dev] FAIL", e?.message || e);
  process.exit(1);
});
