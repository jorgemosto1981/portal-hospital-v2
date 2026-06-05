/**
 * Fase 1 — RFC plan paralelo: limpieza planes test + migración schema plt_*.
 * Uso:
 *   node scripts/fase1-migrate-plan-paralelo-schema.mjs
 *   node scripts/fase1-migrate-plan-paralelo-schema.mjs --apply
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const {
  PLAN_ROL_PRINCIPAL,
  buildAgentesIndicesDenormalizados,
} = require(join(repoRoot, "functions/modules/asistencia/planTurnoServicioMeta.js"));

const apply = process.argv.includes("--apply");

const TEST_PLAN_IDS_HARD_DELETE = [
  "plt_01KSHVPTSDNYDTKVPQGQTNBNJJ",
  "plt_01KSHVWGQEN0Z2NPJTQVVR6E9S",
];

function loadGac() {
  const envFile = join(repoRoot, ".env.v2.local");
  const line = readFileSync(envFile, "utf8")
    .split("\n")
    .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="));
  return line
    ?.split("=")
    .slice(1)
    .join("=")
    .trim()
    .replace(/^["']|["']$/g, "");
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}
const db = getFirestore();
const COL = "planes_turno_servicio";

function agentesArrayFromPlan(data) {
  const ag = data?.agentes;
  if (Array.isArray(ag)) return ag;
  if (ag && typeof ag === "object") {
    return Object.entries(ag).map(([persona_id, rest]) => ({
      persona_id,
      ...(typeof rest === "object" && rest ? rest : {}),
    }));
  }
  return [];
}

async function main() {
  console.log(apply ? "=== FASE 1 APPLY ===" : "=== FASE 1 AUDIT ===");

  const deletes = [];
  for (const id of TEST_PLAN_IDS_HARD_DELETE) {
    const snap = await db.collection(COL).doc(id).get();
    deletes.push({ id, exists: snap.exists, estado: snap.exists ? snap.data()?.estado : null });
  }
  console.log("\nHard delete planes test:", deletes);

  const snap = await db.collection(COL).get();
  const migraciones = [];
  for (const d of snap.docs) {
    if (TEST_PLAN_IDS_HARD_DELETE.includes(d.id)) continue;
    const data = d.data();
    const agentes = agentesArrayFromPlan(data);
    const indices = buildAgentesIndicesDenormalizados(agentes);
    const rolActual = data.plan_rol;
    const necesita =
      rolActual !== PLAN_ROL_PRINCIPAL ||
      data.plan_padre_id != null ||
      JSON.stringify(data.agentes_persona_ids || []) !== JSON.stringify(indices.agentes_persona_ids) ||
      JSON.stringify(data.agentes_hlg_ids || []) !== JSON.stringify(indices.agentes_hlg_ids);
    if (necesita) {
      migraciones.push({
        id: d.id,
        estado: data.estado,
        tipo_plan: data.tipo_plan,
        n_personas: indices.agentes_persona_ids.length,
        n_hlg: indices.agentes_hlg_ids.length,
      });
    }
  }
  console.log("\nPlanes a migrar (schema RFC):", migraciones.length);
  console.log(migraciones);

  if (!apply) {
    console.log("\nSin cambios. Usar --apply para ejecutar.");
    return;
  }

  let ops = 0;
  const batch = db.batch();

  for (const { id, exists } of deletes) {
    if (!exists) continue;
    batch.delete(db.collection(COL).doc(id));
    ops += 1;
  }

  for (const m of migraciones) {
    const ref = db.collection(COL).doc(m.id);
    const docSnap = await ref.get();
    if (!docSnap.exists) continue;
    const data = docSnap.data();
    const agentes = agentesArrayFromPlan(data);
    const indices = buildAgentesIndicesDenormalizados(agentes);
    batch.update(ref, {
      plan_rol: PLAN_ROL_PRINCIPAL,
      plan_padre_id: null,
      agentes_persona_ids: indices.agentes_persona_ids,
      agentes_hlg_ids: indices.agentes_hlg_ids,
      schema_plan_paralelo_version: 1,
      actualizado_en: FieldValue.serverTimestamp(),
      fase1_migrado_en: new Date().toISOString(),
    });
    ops += 1;
  }

  if (ops === 0) {
    console.log("\nNada que escribir.");
    return;
  }
  if (ops > 450) {
    console.error("Batch > 450 ops:", ops);
    process.exit(1);
  }
  await batch.commit();
  console.log("\nCommit OK. Operaciones:", ops);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
