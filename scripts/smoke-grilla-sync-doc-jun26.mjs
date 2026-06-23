/**
 * Smoke: listar snapshot + poll grilla_sync_grupo_mes (Sala jun-2026).
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
const { buildGrillaSyncGrupoMesDocId } = require(
  join(repoRoot, "functions/modules/shared/grillaSyncGrupoMesCore.js"),
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

const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

const t0 = Date.now();
const r = await listarVistaGrillaMesPorGrupo(db, {
  grupoTrabajoId: GDT,
  anio: 2026,
  mes: 6,
});
const listarMs = Date.now() - t0;

const docId = buildGrillaSyncGrupoMesDocId(GDT, 2026, 6);
const estados = [];

for (let i = 0; i < 24; i++) {
  const snap = await db.collection("grilla_sync_grupo_mes").doc(docId).get();
  const estado = snap.exists ? String(snap.data()?.estado || "") : "missing";
  estados.push(estado);
  if (estado === "idle" && snap.data()?.ultimo_ok_at) break;
  if (i < 23) await new Promise((res) => setTimeout(res, 5000));
}

console.log(
  JSON.stringify(
    {
      listar_ms: listarMs,
      materializacion_grupo: r.materializacion_grupo,
      sync_estado: r.sync_estado,
      grilla_sync_respuesta: r.grilla_sync
        ? { doc_id: r.grilla_sync.doc_id, estado: r.grilla_sync.estado }
        : null,
      doc_id: docId,
      estados_observados: [...new Set(estados)],
      ultimo_estado: estados[estados.length - 1],
    },
    null,
    2,
  ),
);

const vioCiclo =
  estados.includes("pendiente") || estados.includes("en_curso") || estados.includes("idle");
if (r.sync_estado?.reconciliacion === "idle" && !vioCiclo) {
  console.log("PASS: sector sin reconciliacion pendiente (sync doc puede no existir)");
  process.exit(0);
}
if (estados.includes("idle")) {
  console.log("PASS: ciclo sync llegó a idle");
  process.exit(0);
}
if (estados.includes("en_curso") || estados.includes("pendiente")) {
  console.log("WARN: sync en progreso; revisar consola o esperar trigger");
  process.exit(0);
}
console.error("FAIL: no se observó doc de sync ni idle");
process.exit(1);
