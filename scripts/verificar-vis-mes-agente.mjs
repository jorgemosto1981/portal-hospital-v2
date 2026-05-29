/**
 * Verifica vis_* scoped post materialización.
 * Uso: node scripts/verificar-vis-mes-agente.mjs --persona=per_... --gdt=gdt_... --periodo=2026-06
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
const { buildVisDocumentId, buildAsiDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

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

function parseArgs(argv) {
  const out = { persona: "", gdt: "", periodo: "", dni: "" };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--persona=")) out.persona = arg.slice(10).trim();
    if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    if (arg.startsWith("--periodo=")) out.periodo = arg.slice(10).trim();
    if (arg.startsWith("--dni=")) out.dni = arg.slice(6).trim();
  }
  return out;
}

const args = parseArgs(process.argv);
const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

let pid = args.persona;
if (!pid && args.dni) {
  const snap = await db.collection("personas").where("dni", "==", args.dni).limit(1).get();
  if (snap.empty) {
    console.error("Persona no encontrada DNI", args.dni);
    process.exit(1);
  }
  pid = snap.docs[0].id;
}

if (!/^per_/i.test(pid) || !/^gdt_/i.test(args.gdt) || !/^\d{4}-\d{2}$/.test(args.periodo)) {
  console.error("Uso: --persona=per_*|--dni=... --gdt=gdt_* --periodo=YYYY-MM");
  process.exit(1);
}

const [anioStr, mesStr] = args.periodo.split("-");
const anio = Number(anioStr);
const mes = Number(mesStr);
const diasMes = new Date(anio, mes, 0).getDate();
const visId = buildVisDocumentId(pid, `${args.periodo}-01`, args.gdt);
const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
const dias = visSnap.exists ? visSnap.data().dias || {} : {};

let turnos = 0;
let francos = 0;
let feriados = 0;
let keys = 0;
const muestra = [];

for (let d = 1; d <= diasMes; d++) {
  const k = String(d).padStart(2, "0");
  const c = dias[k] || dias[d];
  if (!c) continue;
  keys++;
  if (c.rda_ingreso) {
    turnos++;
    if (muestra.length < 3) muestra.push(`${k}:${c.rda_ingreso}-${c.rda_egreso}`);
  } else if (c.es_franco) francos++;
  else if (c.es_feriado) feriados++;
}

let asiCapa = 0;
for (let d = 1; d <= diasMes; d++) {
  const fecha = `${args.periodo}-${String(d).padStart(2, "0")}`;
  const asiSnap = await db.collection("asistencia_diaria").doc(buildAsiDocumentId(pid, fecha)).get();
  if (!asiSnap.exists) continue;
  const capa = (asiSnap.data().capa_teorica_por_grupo || {})[args.gdt];
  if (capa && (capa.tipo_dia || capa.segmentos?.length || capa.turno_compuesto_id)) asiCapa++;
}

console.log(
  JSON.stringify(
    {
      ok: visSnap.exists && turnos > 0,
      persona_id: pid,
      grupo_id: args.gdt,
      periodo: args.periodo,
      vis_id: visId,
      vis_exists: visSnap.exists,
      dias_mes: diasMes,
      dias_con_celda: keys,
      dias_con_turno: turnos,
      francos,
      feriados,
      asi_dias_capa_grupo: asiCapa,
      muestra_turnos: muestra,
    },
    null,
    2,
  ),
);

if (!visSnap.exists || keys < diasMes) {
  process.exitCode = 1;
}
