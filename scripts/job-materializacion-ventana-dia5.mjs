/**
 * Ejecuta job ventana día 5 (§17.2.1) vía Admin SDK — mismo core que el callable.
 *
 * Uso:
 *   node scripts/job-materializacion-ventana-dia5.mjs --fecha=2026-06-05 --dry-run --force
 *   node scripts/job-materializacion-ventana-dia5.mjs --fecha=2026-06-05 --gdt=gdt_...
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
    fecha: "",
    dryRun: false,
    force: false,
    personaId: "",
    gdt: "",
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") out.dryRun = true;
    if (arg === "--force") out.force = true;
    if (arg.startsWith("--fecha=")) out.fecha = arg.slice(8).trim();
    if (arg.startsWith("--persona=")) out.personaId = arg.slice(10).trim();
    if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
  }
  return out;
}

const args = parseArgs(process.argv);
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.fecha)) {
  console.error(
    "Uso: node scripts/job-materializacion-ventana-dia5.mjs --fecha=YYYY-MM-DD [--dry-run] [--force] [--gdt=...] [--persona=per_...]",
  );
  process.exit(1);
}

const gac = loadGacPath();
if (!getApps().length) {
  const cred = JSON.parse(readFileSync(gac, "utf8"));
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || cred.project_id || "portal-hospital-v2";
  initializeApp({ credential: cert(cred) });
}

const { ejecutarJobMaterializacionVentanaDia5 } = require(
  join(repoRoot, "functions/modules/asistencia/jobMaterializacionVentanaDia5.js"),
);

const db = getFirestore();
const t0 = Date.now();
const result = await ejecutarJobMaterializacionVentanaDia5(db, {
  fechaReferenciaYmd: args.fecha,
  dryRun: args.dryRun,
  force: args.force,
  soloPersonaId: args.personaId || null,
  soloGrupoId: args.gdt || null,
  origen: "script_admin",
});

console.log(JSON.stringify({ ...result, elapsed_ms: Date.now() - t0 }, null, 2));

if (!result.ok) {
  process.exit(1);
}
