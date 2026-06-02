/**
 * Audita (y opcionalmente purga) capa teórica en gdt tras deshabilitar HLg (post fecha corte).
 * Uso:
 *   node scripts/audit-purge-hlg-post-corte.mjs --dni=28914247 --gdt=gdt_... --desde=2026-06-01
 *   node scripts/audit-purge-hlg-post-corte.mjs --dni=28914247 --gdt=gdt_... --desde=2026-06-01 --apply
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
const {
  purgeCapaTeoricaGdtRango,
  resolveHastaPurgeTrasDeshabilitarHlg,
} = require(join(repoRoot, "functions/modules/asistencia/purgeCapaTeoricaGdtRango.js"));

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
  const out = { dni: "", gdt: "", desde: "2026-06-01", hasta: "", apply: false, excludeHlgId: "" };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--dni=")) out.dni = arg.slice(6).trim();
    if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    if (arg.startsWith("--desde=")) out.desde = arg.slice(8).trim();
    if (arg.startsWith("--hasta=")) out.hasta = arg.slice(8).trim();
    if (arg === "--apply") out.apply = true;
    if (arg.startsWith("--exclude-hlg=")) out.excludeHlgId = arg.slice(14).trim();
  }
  return out;
}

function iterMonths(desde, hasta) {
  const out = [];
  let y = Number(desde.slice(0, 4));
  let m = Number(desde.slice(5, 7));
  const endY = Number(hasta.slice(0, 4));
  const endM = Number(hasta.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const psn = await db.collection("personas").where("dni", "==", args.dni).limit(1).get();
if (psn.empty) {
  console.error("Persona no encontrada");
  process.exit(1);
}
const pid = psn.docs[0].id;
const gdt = args.gdt;
const desde = args.desde.slice(0, 10);
let hasta = args.hasta ? args.hasta.slice(0, 10) : "";
if (!hasta) {
  hasta = await resolveHastaPurgeTrasDeshabilitarHlg(db, {
    personaId: pid,
    gdt,
    desdeCorteYmd: desde,
    excludeHlgId: args.excludeHlgId || undefined,
  });
}

let purgeEjecutado = null;
if (args.apply) {
  purgeEjecutado = await purgeCapaTeoricaGdtRango(db, {
    personaId: pid,
    gdt,
    desdeYmd: desde,
    hastaYmd: hasta,
    motivo: "audit_purge_hlg_post_corte",
  });
}

const fantasmas = [];
const muestraOk = [];

for (const periodo of iterMonths(desde, hasta)) {
  const [anioStr, mesStr] = periodo.split("-");
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const diasMes = new Date(anio, mes, 0).getDate();
  const visId = buildVisDocumentId(pid, `${periodo}-01`, gdt);
  const visSnap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const dias = visSnap.exists ? visSnap.data().dias || {} : {};

  for (let d = 1; d <= diasMes; d++) {
    const ymd = `${periodo}-${String(d).padStart(2, "0")}`;
    if (ymd < desde || ymd > hasta) continue;
    const k = String(d).padStart(2, "0");
    const c = dias[k] || dias[d];
    if (c && (c.rda_turno_id || c.rda_ingreso || c.rda_egreso)) {
      fantasmas.push({ ymd, fuente: "vis", rda_ingreso: c.rda_ingreso, tipo_dia: c.tipo_dia });
    }
    const asiSnap = await db.collection("asistencia_diaria").doc(buildAsiDocumentId(pid, ymd)).get();
    if (asiSnap.exists) {
      const capa = (asiSnap.data().capa_teorica_por_grupo || {})[gdt];
      if (capa && Object.keys(capa).length > 0) {
        const laborable =
          capa.tipo_dia === "laborable" || capa.rda_turno_id || (capa.segmentos && capa.segmentos.length);
        if (laborable) {
          fantasmas.push({
            ymd,
            fuente: "asi",
            tipo_dia: capa.tipo_dia,
            rda_turno_id: capa.rda_turno_id || null,
          });
        }
      }
    }
    if (fantasmas.length === 0 && ymd >= desde && muestraOk.length < 3 && c) {
      muestraOk.push({ ymd, tipo_dia: c.tipo_dia, rda: c.rda_ingreso || null });
    }
  }
}

const hlgSnap = await db
  .collection("historial_laboral_grupos")
  .where("persona_id", "==", pid)
  .where("grupo_de_trabajo_id", "==", gdt)
  .get();

const hlgs = hlgSnap.docs.map((doc) => ({
  id: doc.id,
  activo: doc.data().activo,
  fecha_inicio: doc.data().fecha_inicio,
  fecha_fin: doc.data().fecha_fin,
}));

console.log(
  JSON.stringify(
    {
      persona_id: pid,
      dni: args.dni,
      gdt,
      ventana_auditada: { desde, hasta },
      purge_aplicado: args.apply ? purgeEjecutado : null,
      hlgs_en_gdt: hlgs,
      fantasmas_rda_o_capa_laborable: fantasmas,
      muestra_celdas_sin_rda: muestraOk,
      purge_ok: fantasmas.length === 0,
    },
    null,
    2,
  ),
);

process.exit(fantasmas.length ? 1 : 0);
