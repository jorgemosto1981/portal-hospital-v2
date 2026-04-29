import "./load-env-v2.mjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en entorno (.env.v2.local).");
  process.exit(1);
}

if (!admin.apps.length) {
  const projectId =
    process.env.FIREBASE_V2_PROJECT_ID?.trim() ||
    JSON.parse(readFileSync(credPath, "utf8")).project_id;
  admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore();
const apply = process.argv.includes("--apply");

function toStr(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

async function main() {
  const snap = await db.collection("usuarios_cuenta").get();
  const docs = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      cuenta_id: doc.id,
      persona_id: toStr(data.persona_id),
      estado_acceso: toStr(data.estado_acceso),
      estado_acceso_id: toStr(data.estado_acceso_id),
    };
  });

  const conLegacy = docs.filter((x) => x.estado_acceso_id);
  const paraMigrar = conLegacy.filter((x) => !x.estado_acceso && x.estado_acceso_id);
  const conflictivos = conLegacy.filter(
    (x) => x.estado_acceso && x.estado_acceso_id && x.estado_acceso !== x.estado_acceso_id,
  );
  const soloEliminarLegacy = conLegacy.filter(
    (x) => x.estado_acceso && x.estado_acceso_id && x.estado_acceso === x.estado_acceso_id,
  );

  const updates = [];
  if (apply && conLegacy.length > 0) {
    let batch = db.batch();
    let n = 0;
    for (const row of conLegacy) {
      const ref = db.collection("usuarios_cuenta").doc(row.cuenta_id);
      const payload = { actualizado_en: FieldValue.serverTimestamp() };
      if (!row.estado_acceso && row.estado_acceso_id) payload.estado_acceso = row.estado_acceso_id;
      payload.estado_acceso_id = FieldValue.delete();
      batch.set(ref, payload, { merge: true });
      updates.push({
        cuenta_id: row.cuenta_id,
        persona_id: row.persona_id,
        accion: !row.estado_acceso && row.estado_acceso_id ? "COPIAR_Y_ELIMINAR_LEGACY" : "ELIMINAR_LEGACY",
      });
      n += 1;
      if (n % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (n % 400 !== 0) await batch.commit();
  }

  const out = {
    generado_en: new Date().toISOString(),
    modo: apply ? "APPLY" : "DRY_RUN",
    resumen: {
      total_usuarios_cuenta: docs.length,
      con_campo_legacy_estado_acceso_id: conLegacy.length,
      para_migrar_copiando_a_estado_acceso: paraMigrar.length,
      conflictivos_estado_acceso_vs_legacy: conflictivos.length,
      solo_eliminar_legacy: soloEliminarLegacy.length,
      actualizados: updates.length,
    },
    conflictivos,
    para_migrar: paraMigrar,
    solo_eliminar_legacy: soloEliminarLegacy,
    updates_aplicados: updates,
  };

  const backupsDir = join(process.cwd(), "backups");
  mkdirSync(backupsDir, { recursive: true });
  const outPath = join(
    backupsDir,
    `auditoria-normalizar-estado-acceso-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.log(`[estado-acceso] Archivo generado: ${outPath}`);
}

main().catch((error) => {
  console.error("[estado-acceso] Error:", error?.message || error);
  if (error?.stack) console.error(error.stack);
  process.exit(1);
});
