/**
 * Migra régimen planificado: ids compuestos atómicos (MT, TN, NM, MTN)
 * → descomposición con "+" (M+T, T+N, N+M, M+T+N) en paleta y planes.
 *
 * Tras migrar planes, rematerializa grupo×mes afectados (sobrescribe capa/vis).
 *
 * Uso:
 *   node scripts/migrar-regimen-planificado-compuesto-plus.mjs
 *   node scripts/migrar-regimen-planificado-compuesto-plus.mjs --apply
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

const REGIMEN_ID = "CFG_REG_HOR_1779788226715";
const ATOM_TO_PLUS = {
  MT: "M+T",
  TN: "T+N",
  NM: "N+M",
  MTN: "M+T+N",
};
const ATOM_IDS = new Set(Object.keys(ATOM_TO_PLUS));
const PLUS_IDS = new Set(Object.values(ATOM_TO_PLUS));

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

function mapTurnoId(raw) {
  const id = String(raw || "").trim();
  if (!id) return id;
  if (ATOM_TO_PLUS[id]) return ATOM_TO_PLUS[id];
  return id;
}

function planTieneTurnosAtomicos(plan) {
  for (const ag of plan.agentes || []) {
    for (const dia of Object.values(ag.dias || {})) {
      const tid = String(dia?.turno_id || "").trim();
      if (ATOM_IDS.has(tid)) return true;
    }
  }
  return false;
}

function planUsaRegimen(plan, regimenId) {
  if (plan.regimen_horario_id === regimenId) return true;
  return (plan.agentes || []).some((a) => a.regimen_horario_id === regimenId);
}

function contarTurnosEnPlan(plan) {
  const counts = {};
  for (const ag of plan.agentes || []) {
    for (const [, dia] of Object.entries(ag.dias || {})) {
      const tid = String(dia?.turno_id || "").trim();
      if (!tid) continue;
      counts[tid] = (counts[tid] || 0) + 1;
    }
  }
  return counts;
}

function migrarDiasAgente(agentes) {
  let cambios = 0;
  const next = (agentes || []).map((ag) => {
    const dias = { ...(ag.dias || {}) };
    for (const [fecha, dia] of Object.entries(dias)) {
      if (!dia || typeof dia !== "object") continue;
      const antes = String(dia.turno_id || "").trim();
      const despues = mapTurnoId(antes);
      if (despues !== antes) {
        dias[fecha] = { ...dia, turno_id: despues };
        cambios += 1;
      }
    }
    return { ...ag, dias };
  });
  return { agentes: next, cambios };
}

function buildTurnosDisponiblesMigrados(actual) {
  const list = Array.isArray(actual) ? [...actual] : [];
  const byId = new Map(list.map((t) => [String(t.turno_id || "").trim(), { ...t }]));

  for (const [atom, plus] of Object.entries(ATOM_TO_PLUS)) {
    const src = byId.get(atom);
    if (!src && !byId.has(plus)) continue;
    const base = src || byId.get(plus);
    if (!base) continue;
    byId.set(plus, {
      ...base,
      turno_id: plus,
      etiqueta: base.etiqueta || plus.replace(/\+/g, " + "),
    });
    byId.delete(atom);
  }

  const ordenBase = ["M", "T", "N", "M+T", "T+N", "N+M", "M+T+N"];
  const ordenados = [];
  const resto = [...byId.values()];
  for (const id of ordenBase) {
    const t = byId.get(id);
    if (t) ordenados.push(t);
  }
  for (const t of resto) {
    if (!ordenados.some((x) => x.turno_id === t.turno_id)) ordenados.push(t);
  }
  return ordenados;
}

const APPLY = process.argv.includes("--apply");
const gac = loadGac();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const regSnap = await db.collection("cfg_regimen_horario").doc(REGIMEN_ID).get();
if (!regSnap.exists) {
  console.error("Régimen no encontrado:", REGIMEN_ID);
  process.exit(1);
}
const regActual = regSnap.data();
const turnosNuevos = buildTurnosDisponiblesMigrados(regActual.turnos_disponibles);

const planesSnap = await db.collection("planes_turno_servicio").limit(500).get();
const planesAfectados = [];
for (const doc of planesSnap.docs) {
  const plan = doc.data();
  if (plan.eliminado === true) continue;
  if (!planUsaRegimen(plan, REGIMEN_ID) && !planTieneTurnosAtomicos(plan)) continue;
  const antes = contarTurnosEnPlan(plan);
  const { agentes, cambios } = migrarDiasAgente(plan.agentes);
  const despues = contarTurnosEnPlan({ agentes });
  planesAfectados.push({
    plan_id: doc.id,
    grupo_id: plan.grupo_id,
    periodo: plan.periodo,
    estado: plan.estado,
    cambios_dias: cambios,
    turnos_antes: Object.fromEntries(
      Object.entries(antes).filter(([k]) => ATOM_IDS.has(k) || PLUS_IDS.has(k)),
    ),
    turnos_despues: Object.fromEntries(
      Object.entries(despues).filter(([k]) => ATOM_IDS.has(k) || PLUS_IDS.has(k)),
    ),
    agentes,
  });
}

const paresRemat = [...new Set(
  planesAfectados
    .filter((p) => p.estado === "HABILITADO")
    .map((p) => `${p.grupo_id}|${p.periodo}`),
)];

const reporte = {
  modo: APPLY ? "APPLY" : "DRY-RUN",
  regimen_id: REGIMEN_ID,
  turnos_disponibles_antes: (regActual.turnos_disponibles || []).map((t) => t.turno_id),
  turnos_disponibles_despues: turnosNuevos.map((t) => t.turno_id),
  planes_vinculados: planesAfectados.length,
  planes_con_cambios: planesAfectados.filter((p) => p.cambios_dias > 0).length,
  detalle_planes: planesAfectados.map((p) => ({
    plan_id: p.plan_id,
    grupo_id: p.grupo_id,
    periodo: p.periodo,
    estado: p.estado,
    cambios_dias: p.cambios_dias,
    turnos_antes: p.turnos_antes,
    turnos_despues: p.turnos_despues,
  })),
  rematerializar: paresRemat.map((k) => {
    const [gdt, periodo] = k.split("|");
    return { gdt, periodo };
  }),
};

if (APPLY) {
  await db.collection("cfg_regimen_horario").doc(REGIMEN_ID).set({
    turnos_disponibles: turnosNuevos,
    actualizado_en: FieldValue.serverTimestamp(),
    nota_migracion_plus: "2026-06-02 ids compuestos con + (MT→M+T, etc.)",
  }, { merge: true });

  for (const p of planesAfectados) {
    if (p.cambios_dias < 1) continue;
    await db.collection("planes_turno_servicio").doc(p.plan_id).set({
      agentes: p.agentes,
      actualizado_en: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const { materializarGrupoMes } = require(
    join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
  );
  reporte.resultados_rematerializacion = [];
  for (const par of reporte.rematerializar) {
    const [anioStr, mesStr] = par.periodo.split("-");
    const t0 = Date.now();
    const r = await materializarGrupoMes({
      grupoId: par.gdt,
      anio: Number(anioStr),
      mes: Number(mesStr),
    });
    reporte.resultados_rematerializacion.push({
      ...par,
      ok: r.ok,
      procesados: r.procesados,
      fallos: Array.isArray(r.fallos) ? r.fallos.length : 0,
      elapsed_ms: Date.now() - t0,
    });
  }
}

console.log(JSON.stringify(reporte, null, 2));

if (!APPLY) {
  console.log("\n[migrar-plus] Dry-run. Re-ejecutá con --apply para escribir y rematerializar.");
}
