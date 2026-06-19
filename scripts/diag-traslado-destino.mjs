/**
 * Diagnóstico traslado destino v2 en materialización.
 * node scripts/diag-traslado-destino.mjs --fecha=2026-06-08 --persona=per_...
 */
import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { computarCapaTeoricaSliceDia, clasificarReemplazosParaMaterializacion } = require(
  join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
);
const { getFirestore } = require("firebase-admin/firestore");
const { buildAsiDocumentId } = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));
const { buildCapaTeoricaSegmentada, buildSegmentosDesdeTurnoCompuesto } = require(
  join(repoRoot, "functions/modules/asistencia/capaTeoricaSegmentosCore.js"),
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

let fecha = "2026-06-08";
let gdt = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
let persona = "per_01KR3GZX9TB33NHTE2QD5ZP13V";
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--fecha=")) fecha = a.slice(8).trim();
  if (a.startsWith("--gdt=")) gdt = a.slice(6).trim();
  if (a.startsWith("--persona=")) persona = a.slice(10).trim();
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(loadGac(), "utf8"))) });
}

const computed = await computarCapaTeoricaSliceDia({ personaId: persona, grupoId: gdt, fechaYmd: fecha });
const regimen = computed.base?.regimenDoc;

const db = getFirestore();
const asiId = buildAsiDocumentId(persona, fecha);
const asi = (await db.collection("asistencia_diaria").doc(asiId).get()).data();
const activos = (asi?.overrides_turno || []).filter((o) => !o.eliminado && !o.invalidado_por_replanificacion);
const reemplazos = activos.filter((o) => o.tipo === "reemplazo" && String(o.grupo_de_trabajo_id || "") === gdt);
const cls = clasificarReemplazosParaMaterializacion(reemplazos, fecha);
console.log("reemplazos activos:", reemplazos.length);
console.log("trasladoDestinoV2:", cls.trasladoDestinoV2.length, cls.trasladoDestinoV2.map((o) => o.turno_id));
console.log("trasladoOrigenV2:", cls.trasladoOrigenV2.length);
console.log("reemplazosClassic:", cls.reemplazosClassic.length);
const segsT = buildSegmentosDesdeTurnoCompuesto({
  fechaYmd: fecha,
  personaId: persona,
  regimen,
  turnoCompuestoId: "T",
  origen_segmento: "override_cobertura",
});
console.log("base capa segmentos:", (computed.base?.capaBase?.segmentos || []).map((s) => s.segmento_id));
console.log(
  "capa segmentos:",
  (computed.capaSlice?.segmentos || []).map((s) => s.segmento_id),
);
console.log("turno_compuesto_id:", computed.capaSlice?.turno_compuesto_id);
console.log("buildSegmentosDesdeTurnoCompuesto(T):", segsT.length, segsT.map((s) => s.segmento_id));
