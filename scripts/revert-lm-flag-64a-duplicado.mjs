/**
 * Revierte es_licencia_medica erróneo en duplicado legacy 64-A (contaminación smoke UAT).
 * Uso: node scripts/revert-lm-flag-64a-duplicado.mjs [--apply]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ART_DUPLICADO = "art_01KRDTBZRDSK7K9JAPXCYWYFRC";
const apply = process.argv.includes("--apply");
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const gac = readFileSync(join(repoRoot, ".env.v2.local"), "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="))
  ?.split("=")
  .slice(1)
  .join("=")
  ?.trim()
  .replace(/^["']|["']$/g, "");

if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });
const db = getFirestore();

const artRef = db.collection("cfg_articulos").doc(ART_DUPLICADO);
const core = (await artRef.get()).data() || {};
const verId = String(core.version_actual_id || "").trim();
if (!/^ver_/i.test(verId)) {
  console.error("Sin version_actual_id en", ART_DUPLICADO);
  process.exit(1);
}
const verRef = artRef.collection("versiones").doc(verId);
const vd = (await verRef.get()).data() || {};
const ident = vd.bloque_identidad_naturaleza || {};

console.log("Antes:", {
  articulo_id: ART_DUPLICADO,
  codigo: core.codigo,
  es_licencia_medica: ident.es_licencia_medica,
  modo_licencia_medica_id: ident.modo_licencia_medica_id,
});

if (ident.es_licencia_medica !== true) {
  console.log("Ya limpio — nada que hacer.");
  process.exit(0);
}

const patch = {
  bloque_identidad_naturaleza: {
    ...ident,
    es_licencia_medica: false,
    modo_licencia_medica_id: FieldValue.delete(),
  },
};

if (!apply) {
  console.log("\nDry-run. Ejecutar con --apply para persistir.");
  process.exit(0);
}

await verRef.set(patch, { merge: true });
console.log("\nOK — flags LM revertidos en", ART_DUPLICADO, verId);
