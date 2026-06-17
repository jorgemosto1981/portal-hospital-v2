import "./load-env-v2.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(repoRoot, ".env.v2.local");
let gac = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      gac = t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") || gac;
    }
  }
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();
const visId =
  process.argv[2] ||
  "vis_2026_06_per_01KR3GZX9TB33NHTE2QD5ZP13V_gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const diaKey = process.argv[3] || "14";
const doPurge = process.argv.includes("--purge-flat");
const snap = await db.collection("vistas_grilla_mes_agente").doc(visId).get();
const d = snap.data() || {};
if (doPurge) {
  const { FieldValue, FieldPath } = await import("firebase-admin/firestore");
  /** @type {Array<unknown>} */
  const purgaArgs = [];
  const prefix = `dias.${diaKey}.`;
  for (const key of Object.keys(d)) {
    if (key.startsWith(prefix)) purgaArgs.push(new FieldPath(key), FieldValue.delete());
  }
  if (purgaArgs.length) {
    await db.collection("vistas_grilla_mes_agente").doc(visId).update(...purgaArgs);
    console.error("purged", purgaArgs.length / 2, "flat keys");
  }
}
const snap2 = doPurge
  ? await db.collection("vistas_grilla_mes_agente").doc(visId).get()
  : snap;
const d2 = snap2.data() || {};
const keys = Object.keys(d2).filter(
  (k) => k.includes(diaKey) && (k.includes("analitica") || k.includes("fichada")),
);
const nested = d2.dias?.[diaKey]?.analitica_cumplimiento;
console.log(
  JSON.stringify(
    {
      has_dias_map: d2.dias != null && typeof d2.dias === "object",
      dias_14_keys: d2.dias?.[diaKey] ? Object.keys(d2.dias[diaKey]) : [],
      flat: Object.fromEntries(keys.map((k) => [k, d2[k]])),
      nested: nested
        ? {
            fichada_fuera_turno_teorico: nested.fichada_fuera_turno_teorico,
            alertas_activas: nested.alertas_activas,
            ingreso_nominal_iso: nested.disciplina?.ingreso_nominal_iso,
            debito: nested.debito_tiempo,
          }
        : null,
    },
    null,
    2,
  ),
);
