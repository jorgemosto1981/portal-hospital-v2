/**
 * Diagnóstico: por qué listarArticulosIngresoAgente devuelve vacío para un DNI.
 *
 * Uso:
 *   node scripts/diagnostico-listar-64a.mjs --dni=28914247
 *   node scripts/diagnostico-listar-64a.mjs --dni=28914247 --fecha=2026-05-20
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const {
  filterHlcVigentesEnFecha,
  resolverElegibilidadSolicitud,
} = require(join(repoRoot, "functions/modules/shared/solicitudElegibilidadLaboral.js"));
const { loadHlcArray, patronFromVersion } = require(join(repoRoot, "functions/modules/shared/solicitudPatronBAltaMotor.js"));
const { PATRON_SALDO_B } = require(join(repoRoot, "functions/modules/shared/resolvePatronSaldo.js"));

const ARTICULO_64A = "art_01KRNK10V10CH7W5M2W6V558GS";
const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

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

function parseArgs(argv) {
  const out = { dni: "28914247", fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) };
  for (const a of argv) {
    if (a.startsWith("--dni=")) out.dni = a.slice(6).replace(/\D/g, "");
    if (a.startsWith("--fecha=")) out.fecha = a.slice(8).trim();
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local)");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });

const db = getFirestore();

const ps = await db.collection("personas").where("dni", "==", args.dni).limit(2).get();
if (ps.empty) {
  console.error("Sin persona dni=", args.dni);
  process.exit(1);
}
const personaDoc = ps.docs[0];
const personaId = personaDoc.id;
const persona = personaDoc.data() || {};

console.log("=== Diagnóstico 64-A listado ===");
console.log("persona_id:", personaId);
console.log("fecha_desde:", args.fecha);

const hlcArray = await loadHlcArray(db, personaId);
console.log("\nHLC total:", hlcArray.length);
const hlcVigentes = filterHlcVigentesEnFecha(hlcArray, args.fecha);
console.log("HLC vigentes en fecha:", hlcVigentes.length);
for (const h of hlcVigentes) {
  console.log("  -", h.id, {
    escalafon_id: h.escalafon_id,
    rol_id: h.rol_id,
    agrupamiento_id: h.agrupamiento_id,
    fecha_inicio: h.fecha_inicio ?? h.fecha_desde,
    fecha_fin: h.fecha_fin ?? h.fecha_hasta,
  });
}
if (hlcArray.length && !hlcVigentes.length) {
  console.log("\nHLC no vigentes (muestra):");
  for (const h of hlcArray.slice(0, 3)) {
    console.log("  -", h.id, {
      deshabilitado: Boolean(h.deshabilitado_en || h.motivo_deshabilitacion_id),
      fecha_inicio: h.fecha_inicio ?? h.fecha_desde,
      fecha_fin: h.fecha_fin ?? h.fecha_hasta,
      escalafon_id: h.escalafon_id,
      rol_id: h.rol_id,
    });
  }
}

const verSnap = await db
  .collection("cfg_articulos")
  .doc(ARTICULO_64A)
  .collection("versiones")
  .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
  .limit(3)
  .get();

console.log("\n64-A versiones publicadas:", verSnap.size);
if (verSnap.empty) {
  console.error("NO hay versión publicada cfg_est_ver_publicada para", ARTICULO_64A);
  process.exit(1);
}

const verDoc = verSnap.docs[0];
const versionData = verDoc.data() || {};
const patron = patronFromVersion(versionData);
console.log("version_id:", verDoc.id, "patron:", patron);

const filtros = versionData.bloque_elegibilidad_filtros || {};
const circuito = versionData.bloque_workflow_sla_cobertura?.circuito_ingreso_ids || [];
console.log("filtros escalafon_ids:", filtros.escalafon_ids);
console.log("circuito_ingreso_ids:", circuito);

const diasExt = Number(persona.antiguedad_reconocida_dias);
const externos = Number.isFinite(diasExt) && diasExt >= 0 ? Math.floor(diasExt) : 0;

const tokenSim = { portal_role: "rrhh" };
const eleg = resolverElegibilidadSolicitud({
  versionData,
  hlcVigentes,
  personaId,
  fechaDesde: args.fecha,
  diasExternos: externos,
  authToken: tokenSim,
});

console.log("\nresolverElegibilidad (portal_role rrhh simulado):");
console.log("  ok:", eleg.ok);
if (!eleg.ok) {
  console.log("  codigos:", eleg.codigos);
  console.log("  mensajes:", eleg.mensajes);
} else {
  console.log("  hlc_id:", eleg.hlc_id);
}

const salDocId = `sal_2026_${personaId}`;
const salSnap = await db.collection("saldos_articulo_agente").doc(salDocId).get();
console.log("\nSaldo ciclo", salDocId, "existe:", salSnap.exists);
if (salSnap.exists) {
  const bolsas = salSnap.data()?.bolsas || {};
  const bolKey = Object.keys(bolsas).find((k) => k.includes("01KRNK10"));
  if (bolKey) {
    console.log("  bolsa 64-A:", bolKey, bolsas[bolKey]);
  } else {
    console.log("  bolsas keys:", Object.keys(bolsas).slice(0, 8));
  }
}

console.log("\n=> listarArticulos mostraría artículo:", patron === PATRON_SALDO_B && eleg.ok ? "SÍ" : "NO");
