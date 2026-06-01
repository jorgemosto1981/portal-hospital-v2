/**
 * Re-materializa capa teórica + vis_* scoped por gdt para un grupo/mes completo.
 *
 * Uso:
 *   node scripts/materializar-grupo-mes.mjs --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --periodo=2026-06
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";

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
  const out = { gdt: "", periodo: "" };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    if (arg.startsWith("--periodo=")) out.periodo = arg.slice(10).trim();
  }
  return out;
}

const args = parseArgs(process.argv);
if (!/^gdt_/i.test(args.gdt) || !/^\d{4}-\d{2}$/.test(args.periodo)) {
  console.error("Uso: node scripts/materializar-grupo-mes.mjs --gdt=gdt_... --periodo=YYYY-MM");
  process.exit(1);
}

const [anioStr, mesStr] = args.periodo.split("-");
const anio = Number(anioStr);
const mes = Number(mesStr);

const gac = loadGacPath();
if (!getApps().length) {
  const cred = JSON.parse(readFileSync(gac, "utf8"));
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || cred.project_id || "portal-hospital-v2";
  initializeApp({ credential: cert(cred) });
}

const { materializarGrupoMes } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);

console.log(JSON.stringify({ accion: "materializarGrupoMes", grupo_id: args.gdt, anio, mes }, null, 2));

const t0 = Date.now();
const result = await materializarGrupoMes({ grupoId: args.gdt, anio, mes });
const elapsedMs = Date.now() - t0;

console.log(JSON.stringify({ ...result, elapsed_ms: elapsedMs }, null, 2));

if (!result.ok) {
  process.exit(1);
}
