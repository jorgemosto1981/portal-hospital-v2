/**
 * US-15 — smoke capa 4 (fichadas_reales) en vis_* para validar badges P/A en grilla.
 *
 * Por defecto: dry-run (no escribe). Requiere `.env.v2.local` + credenciales Admin.
 *
 * Uso:
 *   node scripts/smoke-us15-fichada-presencia-dev.mjs --dni=28914247 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --fecha=2026-06-10 --modo=presente
 *   node scripts/smoke-us15-fichada-presencia-dev.mjs ... --modo=ausente
 *   node scripts/smoke-us15-fichada-presencia-dev.mjs ... --modo=revert --apply
 *   node scripts/smoke-us15-fichada-presencia-dev.mjs ... --modo=presente --apply
 *
 * --modo:
 *   presente  → fichadas_reales con horarios de prueba
 *   ausente   → fichadas_reales: [] (capa 4 cargada, sin fichada)
 *   revert    → elimina fichadas_reales del día (estado previo a la prueba)
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const {
  resolverFichadaPresencia,
  evaluarContradiccionFichadaTeoria,
} = require(join(repoRoot, "functions/modules/shared/grillaFichadaPresencia.js"));
const { sanitizarDiasVisGso } = require(
  join(repoRoot, "functions/modules/asistencia/grillaVisSanitizeGso.js"),
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
  const out = {
    persona: "",
    dni: "",
    gdt: "",
    fecha: "",
    modo: "presente",
    apply: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--apply") out.apply = true;
    else if (arg.startsWith("--persona=")) out.persona = arg.slice(10).trim();
    else if (arg.startsWith("--dni=")) out.dni = arg.slice(6).trim();
    else if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    else if (arg.startsWith("--fecha=")) out.fecha = arg.slice(8).trim();
    else if (arg.startsWith("--modo=")) out.modo = arg.slice(7).trim().toLowerCase();
  }
  return out;
}

const FICHADAS_PRESENTE = [
  { ingreso: "06:05", egreso: "14:02" },
];

function payloadFichadas(modo) {
  if (modo === "presente") return FICHADAS_PRESENTE;
  if (modo === "ausente") return [];
  return null;
}

const args = parseArgs(process.argv);
const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}
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

const modosValidos = new Set(["presente", "ausente", "revert"]);
if (
  !/^per_/i.test(pid)
  || !/^gdt_/i.test(args.gdt)
  || !/^\d{4}-\d{2}-\d{2}$/.test(args.fecha)
  || !modosValidos.has(args.modo)
) {
  console.error(
    "Uso: --persona=per_*|--dni=... --gdt=gdt_* --fecha=YYYY-MM-DD --modo=presente|ausente|revert [--apply]",
  );
  process.exit(1);
}

const diaKey = diaMesKeyDesdeYmd(args.fecha);
const visId = buildVisDocumentId(pid, args.fecha, args.gdt);
const visRef = db.collection("vistas_grilla_mes_agente").doc(visId);
const visSnap = await visRef.get();

if (!visSnap.exists) {
  console.error("vis_* no existe:", visId);
  process.exit(1);
}

const celdaAntes = (visSnap.data().dias || {})[diaKey] || {};
const celdaSimulada = { ...celdaAntes };

if (args.modo === "revert") {
  delete celdaSimulada.fichadas_reales;
} else {
  celdaSimulada.fichadas_reales = payloadFichadas(args.modo);
}

const presenciaRrhh = resolverFichadaPresencia(celdaSimulada);
const celdaJefe = sanitizarDiasVisGso({ [diaKey]: celdaSimulada })[diaKey];
const contradiccion = evaluarContradiccionFichadaTeoria(celdaSimulada);

const reporte = {
  ok: true,
  dry_run: !args.apply,
  vis_id: visId,
  dia_key: diaKey,
  fecha: args.fecha,
  persona_id: pid,
  grupo_id: args.gdt,
  modo: args.modo,
  celda_antes_tiene_fichadas: "fichadas_reales" in celdaAntes,
  presencia_rrhh: presenciaRrhh,
  fichada_presencia_jefe: celdaJefe.fichada_presencia ?? null,
  sin_fichadas_reales_en_jefe: !("fichadas_reales" in celdaJefe),
  contradiccion_teoria: contradiccion.contradictorio ? contradiccion.tooltip : null,
  patch_desc: args.modo === "revert"
    ? `dias.${diaKey}.fichadas_reales → DELETE`
    : `dias.${diaKey}.fichadas_reales → ${JSON.stringify(payloadFichadas(args.modo))}`,
};

console.log(JSON.stringify(reporte, null, 2));

if (!args.apply) {
  console.log("\nDry-run. Agregá --apply para escribir en Firestore.");
  process.exit(0);
}

if (args.modo === "revert") {
  await visRef.update({ [`dias.${diaKey}.fichadas_reales`]: FieldValue.delete() });
} else {
  await visRef.update({ [`dias.${diaKey}.fichadas_reales`]: payloadFichadas(args.modo) });
}

console.log("\nAplicado. Validá en grilla (RRHH/jefe) el día", args.fecha, "— badge P/A esperado:", presenciaRrhh);
console.log("Revertir: mismo comando con --modo=revert --apply");
