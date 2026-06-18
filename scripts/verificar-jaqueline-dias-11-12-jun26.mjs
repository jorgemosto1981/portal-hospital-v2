/**
 * Verifica celdas 11 y 12 de Jaqueline (jun-2026) tras materialización.
 * node scripts/verificar-jaqueline-dias-11-12-jun26.mjs
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
const { materializarTurnoTeoricoDia, evaluarCoherenciaMaterializacionDia } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);
const { leerVistaGrillaMesAgente } = require(
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

const PER = "per_01KR3GZX9TB33NHTE2QD5ZP13V";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";

function resumenCelda(celda) {
  if (!celda || typeof celda !== "object") return { vacia: true };
  const pres = celda.presentacion_compuesto;
  const tramos = Array.isArray(pres?.tramos) ? pres.tramos.map((t) => t?.etiqueta || t?.turno_id) : [];
  return {
    tipo_dia: celda.tipo_dia ?? null,
    es_franco: celda.es_franco === true,
    rda_turno_id: celda.rda_turno_id ?? null,
    rda_horario_display: celda.rda_horario_display ?? null,
    tramos_presentacion: tramos,
  };
}

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

for (const fecha of ["2026-06-11", "2026-06-12"]) {
  const coh = await evaluarCoherenciaMaterializacionDia({
    personaId: PER,
    grupoId: GDT,
    fechaYmd: fecha,
  });
  const mat = await materializarTurnoTeoricoDia({
    personaId: PER,
    grupoId: GDT,
    fechaYmd: fecha,
  });
  console.log(`\n=== ${fecha} ===`);
  console.log("coherencia_antes:", coh);
  console.log("materializar:", { ok: mat.ok, tipo_dia: mat.tipo_dia, segmentos: mat.segmentos });
}

const vista = await leerVistaGrillaMesAgente(db, {
  personaId: PER,
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
});
const d11 = vista?.dias?.["11"];
const d12 = vista?.dias?.["12"];

const out = {
  persona_id: PER,
  grupo: GDT,
  dia_11: resumenCelda(d11),
  dia_12: resumenCelda(d12),
};

console.log("\n--- VIS tras rematerializar ---");
console.log(JSON.stringify(out, null, 2));

const ok11 = d11?.es_franco === true || d11?.tipo_dia === "franco";
const turno12 = String(d12?.rda_turno_id || "");
const tramos12 = out.dia_12.tramos_presentacion || [];
const ok12Compuesto =
  tramos12.some((t) => /t/i.test(String(t)))
  && tramos12.some((t) => /n/i.test(String(t)))
  || /\+/.test(turno12)
  || (turno12 && tramos12.length >= 2);

if (!ok11) {
  console.error("\nFAIL día 11: se esperaba franco, got", out.dia_11);
  process.exit(1);
}
if (!ok12Compuesto && !/t.*n|n.*t/i.test(turno12)) {
  console.error("\nFAIL día 12: se esperaba T+N compuesto, got", out.dia_12);
  process.exit(1);
}

console.log("\nPASS: día 11 franco y día 12 con señal T+N");
