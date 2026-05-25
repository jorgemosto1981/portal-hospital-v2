/**
 * Asigna roles HLC en custom claims (Firebase Auth), fusionando con los existentes.
 *
 * Uso:
 *   node scripts/dev-set-roles-hlc.mjs 28914247 CFG_RRHH,CFG_JEFE
 *   node scripts/dev-set-roles-hlc.mjs usuario@mail.com CFG_JEFE
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (!existsSync(envFile)) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
      return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const target = process.argv[2];
const rolesArg = process.argv[3];
if (!target || !rolesArg) {
  console.error("Uso: node scripts/dev-set-roles-hlc.mjs <email|DNI> <CFG_RRHH,CFG_JEFE,...>");
  process.exit(1);
}

const rolesNuevos = rolesArg
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
if (rolesNuevos.length === 0) {
  console.error("Indicá al menos un rol HLC (ej. CFG_JEFE).");
  process.exit(1);
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: cert(gac) });

const auth = getAuth();
const db = getFirestore();

const isDni = /^\d{6,12}$/.test(String(target).replace(/\D/g, ""));

let uid;
if (isDni) {
  const dni = String(target).replace(/\D/g, "");
  const ps = await db.collection("personas").where("dni", "==", dni).limit(2).get();
  if (ps.empty) {
    console.error(`No hay persona con dni=${dni}`);
    process.exit(1);
  }
  const personaId = ps.docs[0].id;
  const cu = await db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(1).get();
  if (cu.empty || !cu.docs[0].data()?.auth_uid) {
    console.error(`Sin usuarios_cuenta/auth_uid para ${personaId}`);
    process.exit(1);
  }
  uid = cu.docs[0].data().auth_uid;
} else {
  const u = await auth.getUserByEmail(String(target).trim());
  uid = u.uid;
}

const user = await auth.getUser(uid);
const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
const prevRoles = Array.isArray(prev.roles_hlc_vigentes)
  ? prev.roles_hlc_vigentes.map((x) => String(x).trim()).filter(Boolean)
  : [];
const merged = [...new Set([...prevRoles, ...rolesNuevos])];

await auth.setCustomUserClaims(uid, {
  ...prev,
  roles_hlc_vigentes: merged,
  portal_role: null,
  perfil_rol_id: null,
});

console.log(`[OK] uid=${uid}`);
console.log(`     roles_hlc_vigentes=${JSON.stringify(merged)}`);
console.log("Cerrá sesión y volvé a entrar (o F5 tras refresh de token) para ver el menú actualizado.");
