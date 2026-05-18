import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAO = "art_01KRNYDN5WR7RER7MWXRZ817E7";

function loadGac() {
  for (const line of readFileSync(join(repoRoot, ".env.v2.local"), "utf8").split("\n")) {
    if (line.trim().startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      return line.split("=")[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

if (!getApps().length) initializeApp({ credential: cert(loadGac()) });
const db = getFirestore();

const snap = await db.collection("cfg_articulos").doc(LAO).collection("versiones").get();
for (const d of snap.docs.sort((a, b) => String(a.data().correspondencia_anio).localeCompare(String(b.data().correspondencia_anio)))) {
  const v = d.data();
  const circuito = v.bloque_workflow_sla_cobertura?.circuito_ingreso_ids || [];
  console.log({
    version_id: d.id,
    correspondencia_anio: v.correspondencia_anio ?? v.bloque_identidad_naturaleza?.correspondencia_anio,
    anio_fiscal: v.anio_fiscal,
    nombre_version: v.nombre_version,
    estado_version_id: v.estado_version_id,
    circuito_ingreso_ids: circuito,
  });
}
