/**
 * Lista HLg de una persona (todos los gdt) y resume vis junio por cada gdt con HLg histórico.
 * Uso: node scripts/audit-hlg-persona-gdts.mjs --dni=27667499 --periodo=2026-05
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
const { buildVisDocumentId } = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        const val = t.split("=")[1]?.trim() ?? "";
        return val.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

const dni = process.argv.find((a) => a.startsWith("--dni="))?.slice(6) || "";
const periodo = process.argv.find((a) => a.startsWith("--periodo="))?.slice(10) || "2026-05";
if (!dni) {
  console.error("Uso: --dni=...");
  process.exit(1);
}

const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const psn = await db.collection("personas").where("dni", "==", dni).limit(1).get();
if (psn.empty) process.exit(1);
const pid = psn.docs[0].id;

const hlgSnap = await db.collection("historial_laboral_grupos").where("persona_id", "==", pid).get();
const gdts = new Set();
const hlgs = hlgSnap.docs.map((doc) => {
  const d = doc.data();
  const g = String(d.grupo_de_trabajo_id || "").trim();
  if (g) gdts.add(g);
  return {
    id: doc.id,
    gdt: g,
    activo: d.activo,
    fecha_inicio: d.fecha_inicio,
    fecha_fin: d.fecha_fin,
  };
});

const [anioStr, mesStr] = periodo.split("-");
const anio = Number(anioStr);
const mes = Number(mesStr);
const diasMes = new Date(anio, mes, 0).getDate();

const visResumen = [];
for (const gdt of gdts) {
  const visId = buildVisDocumentId(pid, `${periodo}-01`, gdt);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const dias = visSnap.exists ? visSnap.data().dias || {} : {};
  let conRda = 0;
  let laborables = 0;
  for (let d = 1; d <= diasMes; d++) {
    const k = String(d).padStart(2, "0");
    const c = dias[k];
    if (!c) continue;
    if (c.rda_ingreso) conRda++;
    if (c.tipo_dia === "laborable") laborables++;
  }
  visResumen.push({
    gdt,
    vis_id: visId,
    exists: visSnap.exists,
    dias_con_rda: conRda,
    dias_tipo_laborable: laborables,
  });
}

console.log(JSON.stringify({ persona_id: pid, dni, periodo, hlgs, vis_por_gdt: visResumen }, null, 2));
