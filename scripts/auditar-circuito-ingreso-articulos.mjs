/**
 * Audita circuito_ingreso_ids en artículos básicos (64-A, 64-B, 68-B, LAO por ejercicio).
 *
 * Uso: node scripts/auditar-circuito-ingreso-articulos.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Circuito operativo acordado RRHH 2026-05-18. */
export const CIRCUITO_OPERATIVO_ESPERADO = [
  "CFG_USUARIO",
  "CFG_RRHH",
  "CFG_MEDICO",
  "CFG_VISUALIZADOR",
];

const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

const ARTICULOS = [
  { id: "art_01KRNK10V10CH7W5M2W6V558GS", label: "64-A" },
  { id: "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ", label: "64-B" },
  { id: "art_01KRYEF39ZM0KB0F0Y4GPBH38F", label: "68-B" },
  {
    id: "art_01KRNYDN5WR7RER7MWXRZ817E7",
    label: "LAO",
    /** Mapeo ejercicio → versión publicada (Firestore 2026-05-18). */
    laoVersionesPorAnio: {
      2022: "ver_01KRXKS1TZPHRRG2NNWFHS78GC",
      2023: "ver_01KRPPTZ86XK1GR4MNCJA804TE",
      2024: "ver_01KRNYDP14Y5V6F73DFXPBFATM",
      2025: "ver_01KRPQDTM7BHZKYGKR91BEXHTR",
      2026: "ver_01KRPT6XEF3MD46NZT9SKW42C4",
    },
  },
];

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

function faltanEnCircuito(actual, esperado) {
  const set = new Set(Array.isArray(actual) ? actual.map((x) => String(x).trim()) : []);
  return esperado.filter((r) => !set.has(r));
}

function extrasEnCircuito(actual, esperado) {
  const esp = new Set(esperado);
  return (Array.isArray(actual) ? actual : []).map((x) => String(x).trim()).filter((r) => r && !esp.has(r));
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });

const db = getFirestore();
let ok = 0;
let fail = 0;

console.log("=== Auditoría circuito_ingreso_ids ===");
console.log("Esperado (mínimo):", CIRCUITO_OPERATIVO_ESPERADO.join(", "));
console.log("");

for (const art of ARTICULOS) {
  const verSnap = await db
    .collection("cfg_articulos")
    .doc(art.id)
    .collection("versiones")
    .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
    .get();

  const versiones = verSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (art.laoVersionesPorAnio) {
    for (const [anio, verId] of Object.entries(art.laoVersionesPorAnio)) {
      const match = versiones.find((v) => v.id === verId);
      if (!match) {
        console.log(`[${art.label} ${anio}] ✗ versión ${verId} no publicada o no existe`);
        fail += 1;
        continue;
      }
      const circuito = match.bloque_workflow_sla_cobertura?.circuito_ingreso_ids || [];
      const faltan = faltanEnCircuito(circuito, CIRCUITO_OPERATIVO_ESPERADO);
      const label = `${art.label} ${anio} (${verId})`;
      if (faltan.length === 0) {
        console.log(`[${label}] ✓`, circuito);
        ok += 1;
      } else {
        console.log(`[${label}] ✗ faltan:`, faltan.join(", "), "| actual:", circuito);
        fail += 1;
      }
    }
    continue;
  }

  const pub = versiones[0];
  if (!pub) {
    console.log(`[${art.label}] ✗ sin versión publicada`);
    fail += 1;
    continue;
  }
  const circuito = pub.bloque_workflow_sla_cobertura?.circuito_ingreso_ids || [];
  const faltan = faltanEnCircuito(circuito, CIRCUITO_OPERATIVO_ESPERADO);
  const extras = extrasEnCircuito(circuito, CIRCUITO_OPERATIVO_ESPERADO);
  if (faltan.length === 0) {
    console.log(`[${art.label}] ✓ ${pub.id}`, circuito, extras.length ? `(+${extras.join(", ")})` : "");
    ok += 1;
  } else {
    console.log(`[${art.label}] ✗ ${pub.id} faltan:`, faltan.join(", "), "| actual:", circuito);
    fail += 1;
  }
}

console.log("\n---");
console.log(`OK: ${ok} | Pendientes: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
