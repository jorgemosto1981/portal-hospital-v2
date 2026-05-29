import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require("../functions/modules/shared/mdcRdaDocumentIds.js");
const { registrarCambioTurno } = require("../functions/modules/asistencia/cambiosTurno.js");
const {
  CFG_TOV_COBERTURA_PARCIAL,
  CFG_TCC_CAMBIO_INTERNO,
} = require("../functions/modules/shared/cfgAsistenciaTurnosIds.js");

const TAG = "[smoke-concurrencia-dev]";

function getArg(name, fallback = "") {
  const p = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(p));
  return raw ? raw.slice(p.length) : fallback;
}

function tsToIso(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function getVersionToken(visData) {
  const meta = visData?.metadata || {};
  return tsToIso(meta.version_token) || tsToIso(meta.ultima_sync_teorica);
}

async function cargarCredenciales() {
  const line = readFileSync(".env.v2.local", "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("GOOGLE_APPLICATION_CREDENTIALS="));
  const gac = (line?.split("=")[1] || "").trim().replace(/^["']|["']$/g, "");
  if (!gac || !existsSync(gac)) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  const sa = JSON.parse(readFileSync(gac, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
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

async function main() {
  await cargarCredenciales();
  const db = getFirestore();

  const personaOrigen = getArg("persona-origen", "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ");
  const personaCobertura = getArg("persona-cobertura", "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB");
  const fecha = getArg("fecha", "2026-06-10");
  const segmento = getArg("segmento", "cfg_reg_turno_01_manana");
  const gdt = await resolverGdt(db, personaOrigen, fecha, getArg("gdt", ""));

  const visId = buildVisDocumentId(personaOrigen, fecha, gdt);
  const visRef = db.collection("vistas_grilla_mes_agente").doc(visId);

  const beforeSnap = await visRef.get();
  const tokenA = getVersionToken(beforeSnap.data());
  if (!tokenA) throw new Error("No se pudo obtener Token A desde vis_*. Materializá la grilla antes del smoke.");

  const payloadBase = {
    persona_id: personaOrigen,
    fecha,
    grupo_trabajo_id: gdt,
    override: {
      tipo: "cobertura_parcial",
      tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
      tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
      persona_origen_id: personaOrigen,
      persona_cobertura_id: personaCobertura,
      segmentos_cubiertos: [segmento],
      motivo: `Smoke concurrencia ${new Date().toISOString()}`,
    },
    expected_version_token: tokenA,
  };

  const auth = { uid: "smoke-conc", token: { persona_id: personaOrigen } };
  const ok1 = await registrarCambioTurno.run({ data: payloadBase, auth });

  const afterSnap = await visRef.get();
  const tokenB = getVersionToken(afterSnap.data());

  let expectedFail = null;
  try {
    await registrarCambioTurno.run({
      data: {
        ...payloadBase,
        override: {
          ...payloadBase.override,
          motivo: `Smoke concurrencia stale ${new Date().toISOString()}`,
        },
      },
      auth,
    });
  } catch (e) {
    expectedFail = e?.message || String(e);
  }

  const okFail = Boolean(expectedFail && expectedFail.includes("ASI-CONC-001"));

  console.log(`${TAG} ✅ paso1 success=${Boolean(ok1?.ok)} tokenA=${tokenA}`);
  console.log(`${TAG} ✅ paso2 tokenB=${tokenB}`);
  console.log(`${TAG} ✅ paso3 stale_rejected=${okFail}`);
  console.log(
    JSON.stringify(
      {
        persona_origen: personaOrigen,
        persona_cobertura: personaCobertura,
        grupo_trabajo_id: gdt,
        fecha,
        segmento,
        tokenA,
        tokenB,
        token_cambio_detectado: tokenA !== tokenB,
        stale_rejected: okFail,
        stale_error: expectedFail,
      },
      null,
      2,
    ),
  );

  if (!okFail) throw new Error("El segundo intento con Token A no falló con ASI-CONC-001.");
}

main().catch((e) => {
  console.error(`${TAG} ❌ FAIL`, e?.message || e);
  process.exit(1);
});
