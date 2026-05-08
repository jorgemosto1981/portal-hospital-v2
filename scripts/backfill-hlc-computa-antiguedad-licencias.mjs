import "./load-env-v2.mjs";
import { readFileSync } from "node:fs";
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

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    apply: args.has("--apply"),
  };
}

async function main() {
  const { apply } = parseArgs(process.argv);
  const mode = apply ? "APPLY" : "DRY_RUN";
  const snap = await db.collection("historial_laboral_cargos").get();

  const missing = [];
  snap.docs.forEach((doc) => {
    const data = doc.data() || {};
    if (typeof data.computa_antiguedad_licencias !== "boolean") {
      missing.push({
        hlc_id: doc.id,
        persona_id: data.persona_id || null,
        valor_actual: data.computa_antiguedad_licencias ?? null,
      });
    }
  });

  let updated = 0;
  if (apply && missing.length > 0) {
    let batch = db.batch();
    let ops = 0;
    for (const row of missing) {
      const ref = db.collection("historial_laboral_cargos").doc(row.hlc_id);
      batch.set(
        ref,
        {
          computa_antiguedad_licencias: true,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops += 1;
      updated += 1;
      if (ops % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (ops % 400 !== 0) await batch.commit();
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode,
    summary: {
      total_hlc: snap.size,
      missing_field: missing.length,
      updated,
    },
    sample_missing: missing.slice(0, 20),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log(
      "\nDRY-RUN: sin cambios aplicados. Para aplicar, ejecutar:\nnode scripts/backfill-hlc-computa-antiguedad-licencias.mjs --apply",
    );
  }
}

main().catch((error) => {
  console.error("[backfill-hlc-computa-antiguedad-licencias] Error:", error?.message || error);
  if (error?.stack) console.error(error.stack);
  process.exit(1);
});
