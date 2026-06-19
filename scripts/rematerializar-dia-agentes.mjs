/**
 * Re-materializa un día para agentes (dev QA).
 *   node scripts/rematerializar-dia-agentes.mjs --fecha=2026-06-08 --personas=per_a,per_b
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { materializarTurnoTeoricoDia } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);

function loadGac() {
  for (const line of readFileSync(join(repoRoot, ".env.v2.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      return t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

function parseArgs() {
  let fecha = "2026-06-08";
  let gdt = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
  let personas = [
    "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB",
    "per_01KR3HD24AMJ6YX3N7B3GPAZJ4",
  ];
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--fecha=")) fecha = a.slice(8).trim();
    if (a.startsWith("--gdt=")) gdt = a.slice(6).trim();
    if (a.startsWith("--personas=")) {
      personas = a.slice(11).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return { fecha, gdt, personas };
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}

const { fecha, gdt, personas } = parseArgs();
for (const personaId of personas) {
  const mat = await materializarTurnoTeoricoDia({ personaId, grupoId: gdt, fechaYmd: fecha });
  console.log(
    personaId,
    JSON.stringify({
      ok: mat.ok,
      error: mat.error,
      turno_compuesto_id: mat.turno_compuesto_id,
      segmentos: mat.segmentos,
      fichadas_esperadas: mat.fichadas_esperadas,
    }),
  );
}
