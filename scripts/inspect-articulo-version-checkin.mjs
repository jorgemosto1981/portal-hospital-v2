/**
 * Inspecciona versión publicada de un artículo y el patrón de saldo para check-in.
 * Uso: node scripts/inspect-articulo-version-checkin.mjs <articulo_id> [version_id]
 */
import "../scripts/load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const resolveMod = await import(
  pathToFileURL(join(repoRoot, "web/src/features/checkinSaldos/resolvePatronSaldo.js")).href
);
const { resolvePatronSaldo, patronSaldoLabel } = resolveMod;

const artId = process.argv[2];
const verIdArg = process.argv[3];

if (!/^art_/i.test(artId || "")) {
  console.error("Uso: node scripts/inspect-articulo-version-checkin.mjs <articulo_id> [version_id]");
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, "utf8"))) });
}

const db = getFirestore();
const coreSnap = await db.doc(`cfg_articulos/${artId}`).get();
if (!coreSnap.exists) {
  console.error("No existe cfg_articulos/", artId);
  process.exit(1);
}

const core = coreSnap.data();
const verId = verIdArg || String(core.version_actual_id || "").trim();
if (!/^ver_/i.test(verId)) {
  console.error("Sin version_id (pasar como 2º argumento o version_actual_id en core)");
  process.exit(1);
}

const verSnap = await db.doc(`cfg_articulos/${artId}/versiones/${verId}`).get();
if (!verSnap.exists) {
  console.error("No existe versión", verId);
  process.exit(1);
}

const v = verSnap.data();
const ident = v.bloque_identidad_naturaleza || {};
const topes = v.bloque_topes_plazos_computo || {};
const patron = resolvePatronSaldo(topes.reinicio_ciclo_id, topes.origen_saldo_id, ident.es_lao_anual === true);

const report = {
  articulo_id: artId,
  version_id: verId,
  codigo: core.codigo,
  nombre: core.nombre,
  estado_version_id: v.estado_version_id,
  es_lao_anual: ident.es_lao_anual === true,
  unidad_medida_id: topes.unidad_medida_id,
  reinicio_ciclo_id: topes.reinicio_ciclo_id,
  origen_saldo_id: topes.origen_saldo_id,
  accion_saldo_id: topes.accion_saldo_id,
  regla_computo_horas_id: topes.regla_computo_horas_id,
  patron_resuelto: patron,
  patron_label: patronSaldoLabel(patron),
  checkin_pestana: patron === "A" ? "LAO (A)" : patron === "B" ? "Ciclos (B)" : patron === "C" ? "Cuenta continua (C)" : "—",
  ok_68b:
    patron === "C" &&
    topes.unidad_medida_id === "cfg_uma_horas" &&
    topes.reinicio_ciclo_id === "cfg_rcc_nunca" &&
    topes.origen_saldo_id === "cfg_os_externo_informado" &&
    ident.es_lao_anual !== true,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok_68b ? 0 : 2);
