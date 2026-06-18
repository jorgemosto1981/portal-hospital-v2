import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildAsiDocumentId } = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));

function loadServiceAccount() {
  const envFile = join(repoRoot, ".env.v2.local");
  let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      gac = t.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
  return JSON.parse(readFileSync(gac, "utf8"));
}

const PER = "per_01KR3GZX9TB33NHTE2QD5ZP13V";
const GDT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";

if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
const db = getFirestore();

for (const fecha of ["2026-06-11", "2026-06-12"]) {
  const id = buildAsiDocumentId(PER, fecha);
  const snap = await db.collection("asistencia_diaria").doc(id).get();
  const data = snap.exists ? snap.data() : null;
  const ovs = Array.isArray(data?.overrides_turno) ? data.overrides_turno : [];
  const capa = data?.capa_teorica_por_grupo?.[GDT];
  console.log(`\n${fecha} ${id} exists=${snap.exists}`);
  console.log(
    "overrides activos:",
    ovs.filter((o) => !o.eliminado && !o.invalidado_por_replanificacion).map((o) => ({
      tipo: o.tipo,
      leg: o.reemplazo_traslado_v2,
      franco: o.franco_en_origen,
      gdt: o.grupo_de_trabajo_id,
      segs: o.segmentos_a_trasladar,
      fo: o.fecha_origen,
      fd: o.fecha_destino,
    })),
  );
  console.log("capa tipo_dia", capa?.tipo_dia, "segmentos", capa?.segmentos?.map((s) => s.segmento_id));
}
