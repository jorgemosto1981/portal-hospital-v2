/**
 * Quita de vis_* eventos MDC cuyo sol_id no existe en solicitudes_articulo
 * (p. ej. fan-out UAT P2 sin solicitud real).
 *
 * Uso:
 *   node scripts/revert-fanout-huerfanos-vis.mjs --persona=per_... --anio=2026 --mes=6
 *   node scripts/revert-fanout-huerfanos-vis.mjs --persona=per_... --anio=2026 --mes=6 --apply
 */
import "./load-env-v2.mjs";
import { FieldValue } from "firebase-admin/firestore";

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getAdminDb } from "./lib/firestoreAdminBootstrap.mjs";

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const { calcularTieneConflictoDia } = require(
  join(repoRoot, "functions/modules/shared/mdcVisConflictoDia.js"),
);

const COL_VIS = "vistas_grilla_mes_agente";
const COL_SOL = "solicitudes_articulo";

function parseArgs(argv) {
  const out = { apply: false, anio: 2026, mes: 6 };
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--persona=")) out.persona = a.slice(10).trim();
    else if (a.startsWith("--anio=")) out.anio = Number(a.slice(7));
    else if (a.startsWith("--mes=")) out.mes = Number(a.slice(6));
    else if (a.startsWith("--gdt=")) out.gdt = a.slice(6).trim();
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const personaId = args.persona || "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const anio = args.anio;
const mes = args.mes;

const db = getAdminDb();

let q = db
  .collection(COL_VIS)
  .where("persona_id", "==", personaId)
  .where("anio", "==", anio)
  .where("mes", "==", mes);
if (args.gdt) {
  q = q.where("grupo_de_trabajo_id", "==", args.gdt);
}

const snap = await q.get();
const report = { docs: snap.size, removidos: [], aplicado: args.apply };

for (const doc of snap.docs) {
  const data = doc.data() || {};
  const dias = { ...(data.dias || {}) };
  let dirty = false;

  for (const [diaKey, celda] of Object.entries(dias)) {
    const eventos = Array.isArray(celda?.eventos) ? celda.eventos : [];
    if (!eventos.length) continue;

    const kept = [];
    for (const ev of eventos) {
      const solId = String(ev?.solicitud_id || "").trim();
      if (!/^sol_/i.test(solId)) {
        kept.push(ev);
        continue;
      }
      const solSnap = await db.collection(COL_SOL).doc(solId).get();
      if (solSnap.exists) {
        kept.push(ev);
        continue;
      }
      report.removidos.push({
        vis_id: doc.id,
        dia_key: diaKey,
        solicitud_id: solId,
        codigo_grilla: ev?.codigo_grilla ?? null,
        articulo_id: ev?.articulo_id ?? null,
      });
      dirty = true;
    }

    if (dirty) {
      dias[diaKey] = {
        ...celda,
        eventos: kept,
        tiene_conflicto: calcularTieneConflictoDia(kept),
      };
    }
  }

  if (dirty && args.apply) {
    await doc.ref.set(
      {
        dias,
        metadata: {
          ultima_sync_mdc: FieldValue.serverTimestamp(),
          limpieza_fanout_huerfano: new Date().toISOString(),
        },
      },
      { merge: true },
    );
  } else if (dirty) {
    report.pendiente_escritura = report.pendiente_escritura || [];
    report.pendiente_escritura.push(doc.id);
  }
}

console.log(JSON.stringify(report, null, 2));
process.exit(0);
