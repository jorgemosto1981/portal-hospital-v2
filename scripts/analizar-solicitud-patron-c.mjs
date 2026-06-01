import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    const text = readFileSync(envFile, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const gac = loadGacPath();
if (!getApps().length) initializeApp({ credential: cert(gac) });
const db = getFirestore();

const solId = process.argv[2] || "sol_01KSG4MA559JESFB9Z1PK2M42A";

const solSnap = await db.collection("solicitudes_articulo").doc(solId).get();
if (!solSnap.exists) { console.log("Solicitud NO encontrada:", solId); process.exit(1); }
const sol = solSnap.data();

console.log("=== SOLICITUD ===");
console.log("id:", solId);
console.log("articulo_id:", sol.articulo_id);
console.log("version_aplicada_id:", sol.version_aplicada_id);
console.log("titular_persona_id:", sol.titular_persona_id);
console.log("patron_saldo:", sol.patron_saldo);
console.log("schema_version:", sol.schema_version);
console.log("estado_solicitud_id:", sol.estado_solicitud_id);
console.log("fecha_desde:", sol.fecha_desde);
console.log("fecha_hasta:", sol.fecha_hasta);
console.log("horas_solicitadas:", sol.horas_solicitadas);
console.log("dias_solicitados:", sol.dias_solicitados);
console.log("motor_dias_descontados:", sol.motor_dias_descontados);
console.log("grupo_trabajo_id_ancla:", sol.grupo_trabajo_id_ancla);
console.log("autorizacion_rrhh_sustituta:", sol.autorizacion_rrhh_sustituta);

const ms = sol.motor_snapshot || {};
console.log("");
console.log("=== MOTOR SNAPSHOT ===");
console.log("motor_version:", ms.motor_version);
console.log("eligible:", ms.eligible);
console.log("cantidad_consumo:", ms.cantidad_consumo);
console.log("unidad_consumo:", ms.unidad_consumo);
console.log("saldo_disponible:", ms.saldo_disponible);
console.log("saldo_restante_preview:", ms.saldo_restante_preview);
console.log("bolsa_id:", ms.bolsa_id);
console.log("saldo_doc_id:", ms.saldo_doc_id);
const checks = ms.checks || [];
console.log(`checks (${checks.length}):`);
for (const c of checks) {
  const icon = c.nivel === "ok" ? "✓" : c.nivel === "bloqueante" ? "✗" : "⚠";
  console.log(`  ${icon} [${c.fase}] ${c.codigo}: ${c.detalle}`);
}
const warns = ms.warnings || [];
if (warns.length) {
  console.log(`warnings (${warns.length}):`);
  for (const w of warns) console.log(`  ⚠ ${w.codigo}: ${w.copy || w.detalle}`);
}

const cu = sol.config_usada || ms.config_usada || {};
console.log("");
console.log("=== CONFIG USADA ===");
console.log("motor_tipo:", cu.motor_tipo);
console.log("version_aplicada_id:", cu.version_aplicada_id);
console.log("unidad_medida_id:", cu.unidad_medida_id);
console.log("reinicio_ciclo_id:", cu.reinicio_ciclo_id);
console.log("origen_saldo_id:", cu.origen_saldo_id);
console.log("tope_dias_por_evento:", cu.tope_dias_por_evento);

const personaId = String(sol.titular_persona_id || "");
const articuloId = String(sol.articulo_id || "");
const salId = `sal_global_${personaId}`;
const salSnap = await db.collection("saldos_articulo_agente").doc(salId).get();

console.log("");
console.log("=== SALDO GLOBAL (post-débito) ===");
console.log("doc_id:", salId);
if (!salSnap.exists) {
  console.log("Documento NO encontrado");
} else {
  const salData = salSnap.data();
  const bolKey = `bol_${articuloId}_global`;
  console.log("bolsa_key:", bolKey);
  const bolsa = salData.bolsas?.[bolKey];
  if (bolsa) {
    console.log("cantidad_inicial:", bolsa.cantidad_inicial);
    console.log("disponible:", bolsa.disponible);
    console.log("consumido:", bolsa.consumido);
    console.log("unidad:", bolsa.unidad);
  } else {
    console.log("Bolsa NO encontrada. Keys:", Object.keys(salData.bolsas || {}));
  }
}

process.exit(0);
