/**
 * UAT flash — historial LM inline P4.3b (core contra Firestore piloto).
 *
 *   node scripts/smoke/med-p43b-historial-flash.mjs
 *   node scripts/smoke/med-p43b-historial-flash.mjs --excluir=sol_...
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));

const TAG = "[smoke-med-p43b-historial]";
const PER = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const REF_KWM0 = "sol_01KWM0R9KMDEJ7ZKS416H5FSGR";
const REF_KWKV = "sol_01KWKVW4SED7ETGKPDMB61ES8Q";
const REF_KWKT = "sol_01KWKTC9BD5BJQ37TMAGADN1XR";

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t
          .slice("GOOGLE_APPLICATION_CREDENTIALS=".length)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function initDb() {
  const { cert, getApps, initializeApp } = requireFns("firebase-admin/app");
  const { getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) throw new Error("Falta GOOGLE_APPLICATION_CREDENTIALS");
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return getFirestore();
}

function parseExcluir(argv) {
  const hit = argv.find((a) => a.startsWith("--excluir="));
  return hit ? hit.slice("--excluir=".length).trim() : "";
}

async function main() {
  const { obtenerHistorialLmTitularBandejaAuditor } = requireFns(
    "./modules/shared/historialLmTitularBandejaAuditorCore.js",
  );
  const db = initDb();
  let excluir = parseExcluir(process.argv.slice(2));

  if (!excluir) {
    const pendSnap = await db
      .collection("solicitudes_articulo")
      .where("titular_persona_id", "==", PER)
      .where("estado_solicitud_id", "==", "cfg_esa_pendiente_clasificacion_medica")
      .limit(3)
      .get();
    excluir = pendSnap.docs[0]?.id || "";
    console.log(
      TAG,
      "pendientes bandeja:",
      pendSnap.docs.map((d) => ({
        id: d.id,
        desde: d.data()?.fecha_inicio_reposo_estimada || d.data()?.fecha_desde,
      })),
    );
  }

  const r = await obtenerHistorialLmTitularBandejaAuditor(db, {
    titular_persona_id: PER,
    excluir_solicitud_id: excluir,
  });

  if (!r.ok) {
    console.error(TAG, "FAIL core", r);
    process.exit(1);
  }

  const ids = r.items.map((i) => i.solicitud_id);
  const checks = [
    ["items_count_lte_5", r.items.length >= 1 && r.items.length <= 5],
    ["excludes_current", !excluir || !ids.includes(excluir)],
    ["contains_KWM0", ids.includes(REF_KWM0)],
    ["contains_KWKV", ids.includes(REF_KWKV)],
    ["contains_KWKT", ids.includes(REF_KWKT)],
    ["all_have_estado_categoria", r.items.every((i) => i.estado_categoria)],
    ["all_have_fechas", r.items.every((i) => i.fecha_desde && i.fecha_hasta)],
  ];

  console.log(TAG, "excluir:", excluir || "(ninguno)");
  console.log(TAG, "items:", r.items.length, "has_more:", r.has_more);
  for (const row of r.items) {
    console.log(
      TAG,
      row.solicitud_id,
      row.estado_label,
      row.fecha_desde,
      "→",
      row.fecha_hasta,
      row.codigo_grilla || "",
    );
  }

  let fail = false;
  for (const [name, ok] of checks) {
    console.log(TAG, ok ? "PASS" : "FAIL", name);
    if (!ok) fail = true;
  }

  if (fail) process.exit(1);
  console.log(TAG, "VEREDICTO: PASS");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
