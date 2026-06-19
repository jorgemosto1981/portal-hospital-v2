/**
 * Reactiva overrides de un lote marcados eliminado por supersession (QA / recuperación).
 *
 *   node scripts/reactivar-overrides-batch.mjs --batch=34b008c2 --persona=per_... --fecha=2026-06-06
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

let batchPrefix = "";
let persona = "per_01KQQJA5Q1VKBTJ74RHQ0HSHSB";
const fechas = [];
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--batch=")) batchPrefix = a.slice(8).trim();
  if (a.startsWith("--persona=")) persona = a.slice(10).trim();
  if (a.startsWith("--fecha=")) fechas.push(a.slice(8).trim());
}
if (!batchPrefix || !fechas.length) {
  console.error("Uso: --batch=PREFIX --fecha=YYYY-MM-DD [--fecha=...] [--persona=per_...]");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}
const db = getFirestore();

for (const fecha of fechas) {
  const asiId = buildAsiDocumentId(persona, fecha);
  const ref = db.collection("asistencia_diaria").doc(asiId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(asiId, "no existe");
    continue;
  }
  const ovs = Array.isArray(snap.data()?.overrides_turno) ? [...snap.data().overrides_turno] : [];
  let n = 0;
  const next = ovs.map((ov) => {
    const bid = String(ov?.op_batch_id || "");
    if (!ov?.eliminado || !bid.startsWith(batchPrefix)) return ov;
    n += 1;
    const { eliminado, supersedido_por_nueva_op, eliminado_en, eliminado_por_uid, eliminado_por_persona_id, motivo_eliminacion, ...rest } = ov;
    return { ...rest, eliminado: false, invalidado_por_replanificacion: false };
  });
  if (!n) {
    console.log(asiId, "sin overrides del lote", batchPrefix);
    continue;
  }
  await ref.update({ overrides_turno: next });
  console.log(asiId, "reactivados", n);
}
