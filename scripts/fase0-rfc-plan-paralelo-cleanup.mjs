/**
 * Fase 0 — RFC plan paralelo + HLg (limpieza BD V2).
 * Uso:
 *   node scripts/fase0-rfc-plan-paralelo-cleanup.mjs           # auditoría (dry-run)
 *   node scripts/fase0-rfc-plan-paralelo-cleanup.mjs --apply   # ejecuta cambios
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");

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

const COL_HLG = "historial_laboral_grupos";
const COL_PLANES = "planes_turno_servicio";

function stripAgentesByHlgIds(agentes, hlgIdsDelete) {
  const before = (agentes || []).length;
  const next = (agentes || []).filter((ag) => {
    const h = String(ag?.hlg_id || "").trim();
    return !h || !hlgIdsDelete.has(h);
  });
  return { next, removed: before - next.length };
}

async function main() {
  console.log(apply ? "=== FASE 0 APPLY ===" : "=== FASE 0 AUDIT (dry-run) ===");

  const hlgSnap = await db.collection(COL_HLG).get();
  const deshabilitadas = [];
  let activas = 0;
  for (const d of hlgSnap.docs) {
    const h = d.data();
    if (h.activo === false) {
      deshabilitadas.push({
        id: d.id,
        persona_id: h.persona_id,
        gdt: h.grupo_de_trabajo_id,
        fi: h.fecha_inicio,
        ff: h.fecha_fin,
      });
    } else {
      activas += 1;
    }
  }
  console.log(
    "\nHLg totales:",
    hlgSnap.size,
    "| activas:",
    activas,
    "| deshabilitadas (delete target):",
    deshabilitadas.length,
  );
  console.log("Deshabilitadas:", deshabilitadas);

  const hlgDeleteSet = new Set(deshabilitadas.map((x) => x.id));
  const hlgExists = new Set(hlgSnap.docs.map((d) => d.id));

  const pltSnap = await db.collection(COL_PLANES).get();
  const fantasmas = [];
  const orphanRefs = [];
  const plansNeedStrip = [];

  for (const d of pltSnap.docs) {
    const p = d.data();
    if (p.eliminado === true && p.estado === "HABILITADO") {
      fantasmas.push({ id: d.id, grupo: p.grupo_id, periodo: p.periodo, estado: p.estado });
    }
    for (const ag of p.agentes || []) {
      const hid = String(ag?.hlg_id || "").trim();
      if (!hid) continue;
      if (!hlgExists.has(hid) || hlgDeleteSet.has(hid)) {
        orphanRefs.push({ plan_id: d.id, hlg_id: hid, estado: p.estado, eliminado: p.eliminado });
      }
    }
    if (hlgDeleteSet.size > 0) {
      const { removed } = stripAgentesByHlgIds(p.agentes, hlgDeleteSet);
      if (removed > 0) {
        plansNeedStrip.push({
          id: d.id,
          removed,
          estado: p.estado,
          grupo: p.grupo_id,
          periodo: p.periodo,
        });
      }
    }
  }

  console.log("\nplt_* fantasmas (eliminado:true + HABILITADO):", fantasmas.length);
  console.log(fantasmas);
  console.log("\nReferencias hlg_id huérfanas o a borrar:", orphanRefs.length);
  console.log(orphanRefs.slice(0, 30));
  if (orphanRefs.length > 30) console.log("... +", orphanRefs.length - 30, "más");
  console.log("\nPlanes con agentes a quitar por HLg deshabilitada:", plansNeedStrip.length);
  console.log(plansNeedStrip);

  if (!apply) {
    console.log("\nSin cambios. Re-ejecutar con --apply para aplicar.");
    return;
  }

  const batch = db.batch();
  let ops = 0;

  for (const h of deshabilitadas) {
    batch.delete(db.collection(COL_HLG).doc(h.id));
    ops += 1;
  }

  for (const f of fantasmas) {
    batch.update(db.collection(COL_PLANES).doc(f.id), {
      estado: "CERRADO",
      actualizado_en: FieldValue.serverTimestamp(),
      fase0_normalizado_fantasma: true,
    });
    ops += 1;
  }

  for (const ps of plansNeedStrip) {
    const ref = db.collection(COL_PLANES).doc(ps.id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const p = snap.data();
    const { next, removed } = stripAgentesByHlgIds(p.agentes, hlgDeleteSet);
    if (removed === 0) continue;
    const payload = {
      agentes: next,
      actualizado_en: FieldValue.serverTimestamp(),
      fase0_purga_hlg_deshabilitada: true,
    };
    if (next.length === 0 && p.eliminado !== true) {
      payload.eliminado = true;
      payload.eliminado_en = new Date().toISOString();
      payload.eliminado_motivo = "fase0_sin_agentes_tras_purga_hlg";
      if (p.estado === "HABILITADO") {
        payload.estado = "CERRADO";
      }
    }
    batch.update(ref, payload);
    ops += 1;
  }

  if (ops === 0) {
    console.log("\nNada que escribir.");
    return;
  }
  if (ops > 450) {
    console.error("Demasiadas operaciones en un batch:", ops, "— abortar; particionar manualmente.");
    process.exit(1);
  }
  await batch.commit();
  console.log("\nCommit OK. Operaciones:", ops);
  console.log(
    "HLg borradas:",
    deshabilitadas.length,
    "| fantasmas normalizados:",
    fantasmas.length,
    "| planes actualizados:",
    plansNeedStrip.length,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
