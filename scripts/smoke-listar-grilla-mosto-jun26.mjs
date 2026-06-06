/**
 * Smoke: listarVistaGrillaMesPorGrupo debe devolver 2 filas para MOSTO en Sala jun-2026.
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { listarVistaGrillaMesPorGrupo } = require(
  join(repoRoot, "functions/modules/shared/grillaMesAgenteCore.js"),
);

function loadServiceAccount() {
  const envFile = join(repoRoot, ".env.v2.local");
  let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!gac) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        gac = t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
  return JSON.parse(readFileSync(gac, "utf8"));
}

const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

const r = await listarVistaGrillaMesPorGrupo(db, {
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
});

const mostoFilas = (r.filas || []).filter((f) => f.persona_id === PER);
console.log(
  JSON.stringify(
    {
      ok: r.ok,
      total_personas: r.total_personas,
      total_filas: r.total_filas,
      mosto_filas: mostoFilas.length,
      mosto: mostoFilas.map((f) => ({
        fila_id: f.fila_id,
        hlg_id: f.hlg_id,
        vigente_desde: f.vigente_desde,
        vigente_hasta: f.vigente_hasta,
        persona_label: f.persona_label,
        carga_horaria_semanal: f.carga_horaria_semanal,
        dias_count: Object.keys(f.dias || {}).length,
      })),
    },
    null,
    2,
  ),
);

if (mostoFilas.length !== 2) {
  console.error("FAIL: se esperaban 2 filas para MOSTO");
  process.exit(1);
}

for (const f of mostoFilas) {
  if (!f.fila_id || !f.hlg_id || !f.vigente_desde || !f.vigente_hasta) {
    console.error("FAIL: fila incompleta", f);
    process.exit(1);
  }
}

console.log("PASS: MOSTO tiene 2 filas por tramo HLg");
