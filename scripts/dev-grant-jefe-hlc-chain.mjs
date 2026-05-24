/**
 * Alta cadena HLc→HLd→HLg con rol CFG_JEFE para piloto (syncSessionClaims lo incluye en el token).
 *
 * Uso: node scripts/dev-grant-jefe-hlc-chain.mjs 28914247 [--apply]
 */
import "./load-env-v2.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const { ulid } = require(join(dirname(fileURLToPath(import.meta.url)), "../web/node_modules/ulid"));
const { computeLaborProfileForPersona } = require("../functions/modules/shared/laborProfile.js");
const { applyLaborAwareSessionClaims } = require("../functions/modules/shared/authClaims.js");

const APPLY = process.argv.includes("--apply");
const dni = String(process.argv[2] || "").replace(/\D/g, "");
if (!/^\d{6,12}$/.test(dni)) {
  console.error("Uso: node scripts/dev-grant-jefe-hlc-chain.mjs <DNI> [--apply]");
  process.exit(1);
}

const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!getApps().length) initializeApp({ credential: cert(gac) });
const db = getFirestore();

const ps = await db.collection("personas").where("dni", "==", dni).limit(1).get();
if (ps.empty) {
  console.error("Persona no encontrada");
  process.exit(1);
}
const personaId = ps.docs[0].id;
const cu = await db.collection("usuarios_cuenta").where("persona_id", "==", personaId).limit(1).get();
const cuentaId = cu.docs[0]?.id;
const authUid = cu.docs[0]?.data()?.auth_uid;

const hlcSnap = await db
  .collection("historial_laboral_cargos")
  .where("persona_id", "==", personaId)
  .where("rol_id", "==", "CFG_JEFE")
  .limit(1)
  .get();
if (!hlcSnap.empty) {
  console.log("[OK] Ya existe HLc con CFG_JEFE:", hlcSnap.docs[0].id);
} else {
  const refHlc = db.collection("historial_laboral_cargos").doc(`hlc_${ulid()}`);
  const refHld = db.collection("historial_laboral_datos").doc(`hld_${ulid()}`);
  const refHlg = db.collection("historial_laboral_grupos").doc(`hlg_${ulid()}`);

  const hlcPayload = {
    persona_id: personaId,
    rol_id: "CFG_JEFE",
    activo: true,
    fecha_desde: "2020-01-01",
    fecha_hasta: null,
  };
  const hldPayload = {
    persona_id: personaId,
    cargo_id: refHlc.id,
    activo: true,
    fecha_inicio: "2025-12-31",
    fecha_fin: null,
  };
  const hlgPayload = {
    persona_id: personaId,
    dato_laboral_id: refHld.id,
    grupo_de_trabajo_id: "gdt_01KR3H81ENQK84ZK21EQWEQQXG",
    activo: true,
    fecha_inicio: "2025-12-31",
    fecha_fin: null,
  };

  console.log("Plan alta CFG_JEFE:");
  console.log(" ", refHlc.id, hlcPayload);
  console.log(" ", refHld.id, hldPayload);
  console.log(" ", refHlg.id, hlgPayload);

  if (APPLY) {
    await refHlc.set(hlcPayload);
    await refHld.set(hldPayload);
    await refHlg.set(hlgPayload);
    console.log("[APPLY] Cadena HLc jefe creada.");
  }
}

if (APPLY && authUid && cuentaId) {
  await applyLaborAwareSessionClaims(authUid, personaId, cuentaId);
  const profile = await computeLaborProfileForPersona(personaId);
  console.log("[APPLY] Claims refrescados:", profile.roles_hlc_vigentes);
} else if (!APPLY) {
  console.log("\n[DRY-RUN] Re-ejecutá con --apply y luego cerrá sesión / re-login.");
}
