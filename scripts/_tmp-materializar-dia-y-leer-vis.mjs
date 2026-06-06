/**
 * Control F-UX.2: materializa un día y muestra capa + vis (fichadas_esperadas).
 * Uso: node scripts/_tmp-materializar-dia-y-leer-vis.mjs --persona=per_... --gdt=gdt_... --fecha=2026-06-15
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const out = { persona: "", gdt: "", fecha: "" };
  for (const a of argv) {
    if (a.startsWith("--persona=")) out.persona = a.slice(10);
    else if (a.startsWith("--gdt=")) out.gdt = a.slice(6);
    else if (a.startsWith("--fecha=")) out.fecha = a.slice(8);
  }
  return out;
}

function loadGac() {
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

const args = parseArgs(process.argv.slice(2));
if (!args.persona || !args.gdt || !args.fecha) {
  console.error("Uso: --persona=per_... --gdt=gdt_... --fecha=YYYY-MM-DD");
  process.exit(1);
}

const gac = loadGac();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(gac, "utf8"));
if (!getApps().length) initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const { materializarTurnoTeoricoDia } = require(join(
  repoRoot,
  "functions/modules/asistencia/rdaTurnoTeoricoWorker.js",
));
const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd } = require(join(
  repoRoot,
  "functions/modules/shared/mdcRdaDocumentIds.js",
));
const { resolverCapaTeoricaGrupo } = require(join(
  repoRoot,
  "functions/modules/shared/capaTeoricaPorGrupoCore.js",
));

const r = await materializarTurnoTeoricoDia({
  personaId: args.persona,
  grupoId: args.gdt,
  fechaYmd: args.fecha,
});
console.log("materializar:", r);

const asiSnap = await db.collection("asistencia_diaria").doc(buildAsiDocumentId(args.persona, args.fecha)).get();
const visSnap = await db.collection("vistas_grilla_mes_agente").doc(buildVisDocumentId(args.persona, args.fecha, args.gdt)).get();
const capa = resolverCapaTeoricaGrupo(asiSnap.exists ? asiSnap.data() : null, args.gdt);
const diaKey = diaMesKeyDesdeYmd(args.fecha);
const diaVis = visSnap.exists ? visSnap.data()?.dias?.[diaKey] : null;

console.log(
  JSON.stringify(
    {
      proyecto: sa.project_id,
      fecha: args.fecha,
      capa_segmentos: Array.isArray(capa?.segmentos) ? capa.segmentos.length : null,
      capa_turno_compuesto: capa?.turno_compuesto_id ?? null,
      capa_fichadas_esperadas: capa?.fichadas_esperadas ?? null,
      vis_fichadas_esperadas: diaVis?.fichadas_esperadas ?? null,
      vis_rda: diaVis
        ? { ingreso: diaVis.rda_ingreso, egreso: diaVis.rda_egreso, turno: diaVis.rda_turno_id }
        : null,
      ok_alineado:
        capa?.fichadas_esperadas != null &&
        diaVis?.fichadas_esperadas === capa.fichadas_esperadas,
    },
    null,
    2,
  ),
);

if (capa?.fichadas_esperadas == null || diaVis?.fichadas_esperadas !== capa.fichadas_esperadas) {
  process.exit(2);
}
