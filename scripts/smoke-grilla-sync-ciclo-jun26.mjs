/**
 * Smoke: marcar pendiente y observar ciclo hasta idle (trigger en prod).
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

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

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const { db } = require(join(repoRoot, "functions/modules/shared/context.js"));
const {
  marcarGrillaSyncGrupoMesPendiente,
  buildGrillaSyncGrupoMesDocId,
} = require(join(repoRoot, "functions/modules/shared/grillaSyncGrupoMesCore.js"));

await marcarGrillaSyncGrupoMesPendiente(db, {
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
  origen: "smoke_deploy",
});

const docId = buildGrillaSyncGrupoMesDocId(GDT, 2026, 6);
const seen = [];

for (let i = 0; i < 36; i++) {
  const snap = await db.collection("grilla_sync_grupo_mes").doc(docId).get();
  const estado = snap.exists ? String(snap.data()?.estado || "") : "missing";
  if (!seen.length || seen[seen.length - 1] !== estado) seen.push(estado);
  if (estado === "idle") break;
  await new Promise((res) => setTimeout(res, 5000));
}

console.log(JSON.stringify({ docId, transiciones: seen }, null, 2));

if (seen.includes("idle")) {
  console.log("PASS: ciclo sync pendiente → … → idle");
  process.exit(0);
}
console.error("FAIL: no llegó a idle en tiempo", seen);
process.exit(1);
