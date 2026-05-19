/**
 * Asigna `roles_hlc_vigentes: ["CFG_RRHH"]` en custom claims (Firebase Auth).
 * Las callables de RRHH (`rrhhAltaAgente`, etc.) exigen este claim; no basta con datos en Firestore.
 *
 * Uso (raíz del repo, con cuenta de servicio vía .env.v2.local → GOOGLE_APPLICATION_CREDENTIALS):
 *   node scripts/dev-set-portal-role-rrhh.mjs <email@dominio.com>
 *   node scripts/dev-set-portal-role-rrhh.mjs 28914247
 *
 * El segundo forma normaliza DNI, busca `personas` y luego `usuarios_cuenta` para resolver `auth_uid`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
        const v = t.split("=")[1]?.trim() ?? "";
        return v.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: node scripts/dev-set-portal-role-rrhh.mjs <email> | <DNI solo dígitos>");
  process.exit(1);
}

const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS válido en .env.v2.local o en el entorno.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(gac),
  });
}

const auth = getAuth();
const db = getFirestore();

const isDni = /^\d{6,12}$/.test(String(arg).replace(/\D/g, ""));

let uid;
if (isDni) {
  const dni = String(arg).replace(/\D/g, "");
  const ps = await db.collection("personas").where("dni", "==", dni).limit(2).get();
  if (ps.empty) {
    console.error(`No hay documento en personas con dni=${dni}.`);
    process.exit(1);
  }
  if (ps.size > 1) {
    console.error("Más de una persona con el mismo DNI. Corregí en Firestore.");
    process.exit(1);
  }
  const personaId = ps.docs[0].id;
  const cu = await db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(2).get();
  if (cu.empty) {
    console.error(`No hay usuarios_cuenta para ${personaId}.`);
    process.exit(1);
  }
  const cData = cu.docs[0].data() || {};
  if (!cData.auth_uid) {
    console.error(
      "Esa ficha aún no completó el paso B (registro: sin auth_uid). Usá registrarPrimerAcceso o el flujo registro + DNI.",
    );
    process.exit(1);
  }
  uid = cData.auth_uid;
} else {
  const email = String(arg).trim();
  const u = await auth.getUserByEmail(email);
  uid = u.uid;
}

const user = await auth.getUser(uid);
const prev = user.customClaims && typeof user.customClaims === "object" ? { ...user.customClaims } : {};
await auth.setCustomUserClaims(uid, {
  ...prev,
  roles_hlc_vigentes: ["CFG_RRHH"],
  cargo_activo: prev.cargo_activo === true,
  portal_role: null,
  perfil_rol_id: null,
});
console.log(`[OK] roles_hlc_vigentes=[CFG_RRHH] para uid=${uid} (${isDni ? "DNI " + String(arg).replace(/\D/g, "") : user.email || arg})`);
console.log("Cerrá sesión en el navegador o pedí un token nuevo (F5 luego de login) para ver el claim.");
