/**
 * Asegura circuito operativo en versiones publicadas: 64-A, 64-B, 68-B y LAO 2022–2026.
 *
 * Uso:
 *   node scripts/patch-circuito-ingreso-rrhh-medico.mjs           # dry-run
 *   node scripts/patch-circuito-ingreso-rrhh-medico.mjs --apply
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const ROLES_CIRCUITO_OPERATIVO = [
  "CFG_USUARIO",
  "CFG_RRHH",
  "CFG_MEDICO",
  "CFG_VISUALIZADOR",
];

/** @see docs/v2/ARTICULOS_BASICOS_OPERATIVOS_V2.md */
const ARTICULOS_CORE = [
  { articulo_id: "art_01KRNK10V10CH7W5M2W6V558GS", label: "64-A" },
  { articulo_id: "art_01KRYEX0JZY4Y8J1GY3Q9F8BJQ", label: "64-B" },
  { articulo_id: "art_01KRYEF39ZM0KB0F0Y4GPBH38F", label: "68-B" },
  {
    articulo_id: "art_01KRNYDN5WR7RER7MWXRZ817E7",
    label: "LAO",
    laoVersionesPorAnio: {
      2022: "ver_01KRXKS1TZPHRRG2NNWFHS78GC",
      2023: "ver_01KRPPTZ86XK1GR4MNCJA804TE",
      2024: "ver_01KRNYDP14Y5V6F73DFXPBFATM",
      2025: "ver_01KRPQDTM7BHZKYGKR91BEXHTR",
      2026: "ver_01KRPT6XEF3MD46NZT9SKW42C4",
    },
  },
];

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

const apply = process.argv.includes("--apply");
const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(gac) });

const db = getFirestore();

function mergeCircuito(actual) {
  const base = Array.isArray(actual) ? actual.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const set = new Set(base);
  for (const r of ROLES_CIRCUITO_OPERATIVO) set.add(r);
  return [...set];
}

async function patchVersion(ref, label) {
  const snap = await ref.get();
  if (!snap.exists) {
    console.warn(`[${label}] No existe versión`);
    return;
  }
  const data = snap.data() || {};
  if (String(data.estado_version_id || "").trim() !== CFG_EST_VER_PUBLICADA) {
    console.warn(`[${label}] No publicada: ${data.estado_version_id}`);
    return;
  }
  const bloque = data.bloque_workflow_sla_cobertura || {};
  const antes = bloque.circuito_ingreso_ids || [];
  const despues = mergeCircuito(antes);
  console.log(`[${label}]`);
  console.log("  antes:", antes);
  console.log("  después:", despues);
  if (JSON.stringify(antes) === JSON.stringify(despues)) {
    console.log("  (sin cambios)");
    return;
  }
  if (apply) {
    await ref.update({
      "bloque_workflow_sla_cobertura.circuito_ingreso_ids": despues,
      actualizado_en: FieldValue.serverTimestamp(),
    });
    console.log("  ✓ actualizado");
  }
}

console.log(apply ? "=== APPLY ===" : "=== DRY-RUN ===");

for (const art of ARTICULOS_CORE) {
  if (art.laoVersionesPorAnio) {
    for (const [anio, verId] of Object.entries(art.laoVersionesPorAnio)) {
      const ref = db
        .collection("cfg_articulos")
        .doc(art.articulo_id)
        .collection("versiones")
        .doc(verId);
      await patchVersion(ref, `LAO ${anio} (${verId})`);
    }
    continue;
  }

  const verSnap = await db
    .collection("cfg_articulos")
    .doc(art.articulo_id)
    .collection("versiones")
    .where("estado_version_id", "==", CFG_EST_VER_PUBLICADA)
    .limit(1)
    .get();
  if (verSnap.empty) {
    console.warn(`[${art.label}] sin versión publicada`);
    continue;
  }
  await patchVersion(verSnap.docs[0].ref, `${art.label} (${verSnap.docs[0].id})`);
}

if (!apply) {
  console.log("\nEjecutá con --apply para persistir en Firestore.");
}
