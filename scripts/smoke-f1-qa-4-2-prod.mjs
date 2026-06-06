/**
 * Smoke F1 — matriz §4.2 (checks automatizables en prod vía Admin SDK).
 * No sustituye sign-off manual ítems 2, 3, 6, 8, 9.
 *
 * Uso: node scripts/smoke-f1-qa-4-2-prod.mjs
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

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

const gac = loadGacPath();
if (!getApps().length) {
  const cred = JSON.parse(readFileSync(gac, "utf8"));
  initializeApp({ credential: cert(cred), projectId: cred.project_id || "portal-hospital-v2" });
}
const db = getFirestore();

const GDT_PORTERIA = "gdt_01KQA9FVEW53JSNTPGX32NWQ5B";
const GDT_OFICINA = "gdt_01KR3H81ENQK84ZK21EQWEQQXG";
const GDT_SALA = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const PER_MOSTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const PER_LOKITO = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const PER_CHAPARRO = "per_01KR3HD24AMJ6YX3N7B3GPAZJ4";

const acta = { fecha: new Date().toISOString().slice(0, 10), pruebas: [] };

function push(id, resultado, extra = {}) {
  acta.pruebas.push({ id, resultado, ...extra });
}

async function statsVis(pid, gdt, periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  const diasMes = new Date(anio, mes, 0).getDate();
  const visId = buildVisDocumentId(pid, `${periodo}-01`, gdt);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const dias = visSnap.exists ? visSnap.data().dias || {} : {};
  let turnos = 0;
  let francos = 0;
  let nl = 0;
  for (let d = 1; d <= diasMes; d++) {
    const key = String(d).padStart(2, "0");
    const cel = dias[key] || dias[d];
    if (!cel) continue;
    if (cel.rda_ingreso) turnos++;
    else if (cel.es_franco || cel.tipo_dia === "franco") francos++;
    else if (cel.tipo_dia === "no_laborable") nl++;
  }
  return { vis_exists: visSnap.exists, dias_mes: diasMes, turnos, francos, nl };
}

function enRango(ymd, desde, hasta) {
  const d = String(ymd || "").slice(0, 10);
  const i = String(desde || "").slice(0, 10);
  const f = hasta ? String(hasta).slice(0, 10) : "9999-12-31";
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{4}-\d{2}-\d{2}$/.test(i) && i <= d && d <= f;
}

async function existeHlgActivoEnMes(personaId, grupoId, periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  const corte = `${anio}-${String(mes).padStart(2, "0")}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}`;
  const snap = await db
    .collection("historial_laboral_grupos")
    .where("persona_id", "==", personaId)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .get();
  return snap.docs.some((d) => {
    const h = d.data() || {};
    if (h.activo !== true) return false;
    return enRango(corte, h.fecha_inicio, h.fecha_fin);
  });
}

// §4.2 #5 + D2: MOSTO multicargo — mayo Portería.
// Si no hay HLG activo para ese mes, el caso en grilla de equipo es "sin dotación" (SKIP).
const mostoMayP = await statsVis(PER_MOSTO, GDT_PORTERIA, "2026-05");
const mostoMayPorteriaActiva = await existeHlgActivoEnMes(PER_MOSTO, GDT_PORTERIA, "2026-05");
if (!mostoMayPorteriaActiva) {
  push("D2-MOSTO-mayo-Porteria", "SKIP", {
    motivo: "Sin HLG activa en Portería para mayo (grilla sector puede quedar sin dotación por regla activo=true).",
    ...mostoMayP,
  });
} else if (mostoMayP.vis_exists && mostoMayP.turnos >= 8 && mostoMayP.nl < 20) {
  push("D2-MOSTO-mayo-Porteria", "OK", mostoMayP);
} else {
  push("D2-MOSTO-mayo-Porteria", "FAIL", mostoMayP);
}

const mostoJunO = await statsVis(PER_MOSTO, GDT_OFICINA, "2026-06");
if (mostoJunO.vis_exists && mostoJunO.turnos >= 8) {
  push("4.2-5-MOSTO-jun-Oficina", "OK", mostoJunO);
} else {
  push("4.2-5-MOSTO-jun-Oficina", "FAIL", mostoJunO);
}

// LOKITO Oficina jun/jul (incidente plan eliminado — regresión)
const lokJun = await statsVis(PER_LOKITO, GDT_OFICINA, "2026-06");
const lokJul = await statsVis(PER_LOKITO, GDT_OFICINA, "2026-07");
if (lokJun.turnos >= 10) push("LOKITO-jun-Oficina", "OK", lokJun);
else push("LOKITO-jun-Oficina", "FAIL", lokJun);
if (lokJul.turnos >= 10) push("LOKITO-jul-Oficina", "OK", lokJul);
else push("LOKITO-jul-Oficina", "FAIL", lokJul);

// CHAPARRO jun Sala: HLg inactiva desde 2026-06-01 → vis sin turno post-corte es esperado
const hlgSnap = await db
  .collection("historial_laboral_grupos")
  .where("persona_id", "==", PER_CHAPARRO)
  .get();
const hlgSala = hlgSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((h) => h.grupo_de_trabajo_id === GDT_SALA);
const inactivaJun = hlgSala.some(
  (h) => h.activo === false && String(h.fecha_fin || "").startsWith("2026-06"),
);
const chapJun = await statsVis(PER_CHAPARRO, GDT_SALA, "2026-06");
if (inactivaJun && chapJun.turnos === 0) {
  push("4.2-1-CHAPARRO-jun-Sala", "SKIP", {
    motivo: "HLg Sala inactiva desde 2026-06-01; validar mayo Sala o UI grilla equipo",
    ...chapJun,
  });
} else if (chapJun.turnos >= 8) {
  push("4.2-1-CHAPARRO-jun-Sala", "OK", chapJun);
} else {
  push("4.2-1-CHAPARRO-jun-Sala", "FAIL", { inactivaJun, ...chapJun });
}

const mayoChap = await statsVis(PER_CHAPARRO, GDT_SALA, "2026-05");
if (mayoChap.turnos >= 5) push("4.2-1-CHAPARRO-may-Sala", "OK", mayoChap);
else push("4.2-1-CHAPARRO-may-Sala", "FAIL", mayoChap);

acta.resumen = {
  total: acta.pruebas.length,
  ok: acta.pruebas.filter((p) => p.resultado === "OK").length,
  skip: acta.pruebas.filter((p) => p.resultado === "SKIP").length,
  fail: acta.pruebas.filter((p) => p.resultado === "FAIL").length,
};
acta.pendiente_manual = [
  "§4.2 #2 MOSTO LAO + GS-A en gdt correcto",
  "§4.2 #3 LOKITO compuesto (UI)",
  "§4.2 #6 Rehabilitar/eliminar plan sin pisar otro gdt",
  "§4.2 #8 Grilla equipo jefe vs materialización",
  "§4.2 #9 Override jefe scoped",
];

console.log(JSON.stringify(acta, null, 2));
process.exit(acta.resumen.fail > 0 ? 1 : 0);
