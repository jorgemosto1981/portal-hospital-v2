import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const gac = readFileSync(join(repoRoot, ".env.v2.local"), "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
const db = getFirestore();
const snap = await db.collection("planes_turno_servicio").doc("plt_01KSMNGHNTJAYC19Z11Q5ZVT5M").get();
const p = snap.data();
console.log(JSON.stringify({
  id: snap.id,
  estado: p.estado,
  eliminado: p.eliminado,
  eliminado_en: p.eliminado_en,
  motivo_eliminacion: p.motivo_eliminacion,
  eliminado_por_uid: p.eliminado_por_uid,
  periodo: p.periodo,
  grupo_id: p.grupo_id,
}, null, 2));
