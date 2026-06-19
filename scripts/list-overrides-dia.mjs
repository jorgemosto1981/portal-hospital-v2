/**
 *   node scripts/list-overrides-dia.mjs --fecha=2026-06-06 --persona=per_...
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
const { buildAsiDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
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

let fecha = "2026-06-06";
let persona = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--fecha=")) fecha = a.slice(8).trim();
  if (a.startsWith("--persona=")) persona = a.slice(10).trim();
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}
const db = getFirestore();
const asiId = buildAsiDocumentId(persona, fecha);
const snap = await db.collection("asistencia_diaria").doc(asiId).get();
const ovs = snap.exists && Array.isArray(snap.data()?.overrides_turno)
  ? snap.data().overrides_turno
  : [];
console.log(asiId, "count", ovs.length);
for (const [i, ov] of ovs.entries()) {
  console.log(
    i,
    ov.eliminado ? "ELIM" : "ACT",
    ov.reemplazo_traslado_v2 || "-",
    "turno",
    ov.turno_id,
    "segs",
    ov.segmentos_incorporados_destino || ov.segmentos_a_trasladar,
    "batch",
    String(ov.op_batch_id || "").slice(0, 8),
  );
}
