import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
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
const s = await db.collection("planes_turno_servicio").doc("plt_01KSMNGHNTJAYC19Z11Q5ZVT5M").get();
const a = s.data().agentes;
console.log("isArray", Array.isArray(a));
if (Array.isArray(a)) {
  console.log("count", a.length);
  console.log(JSON.stringify(a[0], null, 2)?.slice(0, 800));
} else {
  console.log("keys", Object.keys(a || {}));
  const k = Object.keys(a || {})[0];
  console.log(JSON.stringify(a[k], null, 2)?.slice(0, 800));
}
