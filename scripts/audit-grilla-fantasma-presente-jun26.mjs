/**
 * Audita celdas con inconsistencia: modal diría "Presente" pero sin fichadas_reales.
 * Simula la lógica defectuosa de DiaGrillaAuditoriaCumplimientoHorario (horarioReal truthy).
 *
 *   node scripts/audit-grilla-fantasma-presente-jun26.mjs
 *   node scripts/audit-grilla-fantasma-presente-jun26.mjs --gdt=gdt_... --periodo=2026-06
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
const { fusionarDiasDesdeClavesPlanas } = require(
  join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
);
const { parseFichadasRealesCelda, resolverFichadaPresencia, celdaEsperaFichada } = require(
  join(repoRoot, "functions/modules/shared/grillaFichadaPresencia.js"),
);

const GDT_DEFAULT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const PERIODO_DEFAULT = "2026-06";

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
  let gdt = GDT_DEFAULT;
  let periodo = PERIODO_DEFAULT;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--gdt=")) gdt = a.slice(6);
    if (a.startsWith("--periodo=")) periodo = a.slice(10);
  }
  const [anio, mes] = periodo.split("-").map(Number);
  return { gdt, anio, mes };
}

function filaTramoAusente(fila) {
  const estado = String(fila?.estado_tramo || "").trim();
  const badge = String(fila?.badge_label || "").trim();
  return estado === "ausente" || badge === "AUSENTE";
}

function lineasPresentacionBug(celda) {
  const pres = celda?.presentacion_compuesto;
  const filas = Array.isArray(pres?.filas) ? pres.filas : [];
  if (filas.length >= 1) {
    return filas.map((f) => {
      const seg = String(f.segmento_id || "").trim();
      if (filaTramoAusente(f)) return seg ? `${seg} · AUSENTE` : "AUSENTE";
      const fichada = String(f.fichada_label || "").trim();
      return [seg, fichada].filter(Boolean).join(" · ");
    });
  }
  return [];
}

/** Lógica UI actual (bug): horarioReal truthy → "Presente (fichada)" */
function tituloPresenciaModalBug(celda) {
  const presencia = resolverFichadaPresencia(celda);
  if (presencia === "presente") return "Presente (fichada)";
  if (presencia === "ausente") return "Ausente (sin fichada)";
  const lineas = lineasPresentacionBug(celda);
  const horarioReal = lineas.length ? lineas.join(" | ") : "";
  if (horarioReal) return "Presente (fichada)";
  return "Sin fichada registrada";
}

/** Lógica corregida: solo marcas reales → presente */
function tituloPresenciaModalFix(celda) {
  const presencia = resolverFichadaPresencia(celda);
  const marcas = parseFichadasRealesCelda(celda);
  if (marcas.length > 0) return "Presente (fichada)";
  if (presencia === "ausente") return "Ausente (sin fichada)";
  if (celdaEsperaFichada(celda)) return "Ausente (sin fichada)";
  return "Sin fichada registrada";
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}
const db = getFirestore();
const { gdt, anio, mes } = parseArgs();

const snap = await db
  .collection("vistas_grilla_mes_agente")
  .where("grupo_de_trabajo_id", "==", gdt)
  .where("anio", "==", anio)
  .where("mes", "==", mes)
  .get();

console.log(`Auditoría fantasma-presente · GDT ${gdt} · ${anio}-${String(mes).padStart(2, "0")}`);
console.log(`Documentos vis: ${snap.size}\n`);

/** @type {Array<Record<string, unknown>>} */
const inconsistentes = [];
/** @type {Record<string, number>} */
const motivos = {};

for (const doc of snap.docs) {
  const data = doc.data();
  const personaId = String(data.persona_id || "");
  const dias = fusionarDiasDesdeClavesPlanas(data);
  for (const [dk, celda] of Object.entries(dias)) {
    if (!celda || typeof celda !== "object") continue;
    if (!celdaEsperaFichada(celda)) continue;
    const marcas = parseFichadasRealesCelda(celda);
    if (marcas.length > 0) continue;

    const tituloBug = tituloPresenciaModalBug(celda);
    const tituloFix = tituloPresenciaModalFix(celda);
    if (tituloBug !== "Presente (fichada)") continue;

    const lineas = lineasPresentacionBug(celda);
    const motivo =
      lineas.some((l) => /AUSENTE/i.test(l))
        ? "horarioReal_desde_presentacion_ausente"
        : lineas.length
          ? "horarioReal_desde_presentacion_con_label"
          : "presencia_agregada_o_otro";

    motivos[motivo] = (motivos[motivo] || 0) + 1;

    inconsistentes.push({
      persona_id: personaId,
      dia: dk,
      turno: celda.rda_turno_id,
      fichadas_esperadas: celda.fichadas_esperadas,
      semaforo: celda.validacion_fichada_dia?.estado_semaforo,
      presencia_resolver: resolverFichadaPresencia(celda),
      titulo_bug: tituloBug,
      titulo_fix: tituloFix,
      horarioReal_bug: lineas.join(" | "),
      presentacion_filas: celda.presentacion_compuesto?.filas?.length ?? 0,
      tiene_analitica: Boolean(celda.analitica_cumplimiento),
    });
  }
}

console.log("--- Resumen motivos (UI bug) ---");
for (const [k, v] of Object.entries(motivos).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
console.log(`\nTotal celdas inconsistentes (bug UI): ${inconsistentes.length}`);

if (inconsistentes.length) {
  console.log("\n--- Muestra (max 40) ---");
  for (const row of inconsistentes.slice(0, 40)) {
    console.log(
      JSON.stringify({
        persona: row.persona_id?.slice(-8),
        dia: row.dia,
        turno: row.turno,
        esp: row.fichadas_esperadas,
        sem: row.semaforo,
        horarioReal: row.horarioReal_bug,
        filas: row.presentacion_filas,
      }),
    );
  }
}

console.log("\n--- Cadena post override/intercambio ---");
console.log(`
1. cambiosTurno.materializarDiaAfectado
   → materializarTurnoTeoricoDia + recalcularAnaliticaValidacionFichadaTrasTeoria
2. rdaTurnoTeoricoWorker.persistirAnaliticaCumplimientoDia
   → conserva fichadas_reales (vacías) pero REESCRIBE presentacion_compuesto + analitica
3. validacionFichadaDiaPersistencia.ejecutarAnaliticaYValidacionFichadaDia
   → resolverPresentacionCompuestoCelda (filas M/T/N, tramos ausentes)
4. UI DiaGrillaAuditoriaCumplimientoHorario.jsx
   → tituloPresencia usa horarioReal truthy (incl. "M · AUSENTE") → "Presente (fichada)" INCORRECTO
5. formatearMarcasCrudasFichada lee solo fichadas_reales → "Sin marcas en el día"
`);

process.exit(inconsistentes.length > 0 ? 2 : 0);
