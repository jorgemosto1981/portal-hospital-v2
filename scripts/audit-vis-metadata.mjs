/**
 * Smoke metadata materialización en vis_* (prod/staging).
 * Uso: node scripts/audit-vis-metadata.mjs
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        const val = t.split("=")[1]?.trim() ?? "";
        return val.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function ts(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return value;
}

const gac = loadGacPath();
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

const casos = [
  { label: "MOSTO Oficina jun", per: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ", gdt: "gdt_01KR3H81ENQK84ZK21EQWEQQXG", periodo: "2026-06" },
  { label: "MOSTO Sala jun", per: "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ", gdt: "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V", periodo: "2026-06" },
  { label: "CHAPARRO Sala jun (purge)", per: "per_01KR3HD24AMJ6YX3N7B3GPAZJ4", gdt: "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V", periodo: "2026-06" },
  { label: "CHAPARRO Oficina jun", per: "per_01KR3HD24AMJ6YX3N7B3GPAZJ4", gdt: "gdt_01KR3H81ENQK84ZK21EQWEQQXG", periodo: "2026-06" },
  { label: "CHAPARRO Sala may (cierre)", per: "per_01KR3HD24AMJ6YX3N7B3GPAZJ4", gdt: "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V", periodo: "2026-05" },
];

/** @type {Array<Record<string, unknown>>} */
const resultados = [];

for (const c of casos) {
  const visId = buildVisDocumentId(c.per, `${c.periodo}-01`, c.gdt);
  const snap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
  const data = snap.exists ? snap.data() : null;
  const md = data?.metadata || {};
  resultados.push({
    caso: c.label,
    vis_id: visId,
    exists: snap.exists,
    estado_periodo: data?.estado_periodo_liquidacion_id ?? null,
    tiene_metadata: Boolean(md && Object.keys(md).length),
    ultimo_motivo: md.ultimo_motivo ?? null,
    ultimo_rango_materializado: md.ultimo_rango_materializado ?? null,
    ultimo_purge_motivo: md.ultimo_purge_motivo ?? null,
    ultimo_rango_purged: md.ultimo_rango_purged ?? null,
    ultima_sync_teorica: ts(md.ultima_sync_teorica),
    ultimo_motivo_en: ts(md.ultimo_motivo_en),
    ultimo_purge_en: ts(md.ultimo_purge_en),
  });
}

const conMotivo = resultados.filter((r) => r.ultimo_motivo || r.ultimo_purge_motivo);
console.log(JSON.stringify({ ok: conMotivo.length > 0, total: resultados.length, con_motivo: conMotivo.length, casos: resultados }, null, 2));

if (!conMotivo.length) {
  process.exitCode = 1;
}
