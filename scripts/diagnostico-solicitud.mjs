/**
 * Estado de una solicitud_articulo y bolsa asociada.
 * Uso: node scripts/diagnostico-solicitud.mjs --sol=sol_01KRYP2M4PJRR6K7MJQ90ZWRKB
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const solId = process.argv.find((a) => a.startsWith("--sol="))?.slice(6)?.trim();
if (!solId) {
  console.error("Uso: node scripts/diagnostico-solicitud.mjs --sol=sol_...");
  process.exit(1);
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });

const db = getFirestore();
const snap = await db.collection("solicitudes_articulo").doc(solId).get();
if (!snap.exists) {
  console.error("No existe", solId);
  process.exit(1);
}

const s = snap.data() || {};
console.log("=== Solicitud", solId, "===");
console.log({
  estado_solicitud_id: s.estado_solicitud_id,
  articulo_id: s.articulo_id,
  titular_persona_id: s.titular_persona_id,
  fecha_desde: s.fecha_desde,
  fecha_hasta: s.fecha_hasta,
  dias_solicitados: s.dias_solicitados,
  schema_version: s.schema_version,
  patron_saldo: s.patron_saldo,
  hlc_id: s.hlc_id,
  version_aplicada_id: s.version_aplicada_id,
  motor_codigos: s.motor_codigos,
  motor_mensajes: s.motor_mensajes,
  motor_validado_en: s.motor_validado_en,
});

const pid = String(s.titular_persona_id || "").trim();
const anio = String(s.fecha_desde || "").slice(0, 4);
if (pid && anio) {
  const salId = `sal_${anio}_${pid}`;
  const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();
  if (salSnap.exists) {
    const artId = String(s.articulo_id || "");
    const bolsas = salSnap.data()?.bolsas || {};
    const bolKey = Object.keys(bolsas).find((k) => k.includes(artId.replace("art_", "").slice(0, 12)) || k.includes(artId));
    console.log("\nSaldo", salId);
    if (bolKey) console.log("  bolsa:", bolKey, bolsas[bolKey]);
    else console.log("  bolsas keys:", Object.keys(bolsas));
  }
}
