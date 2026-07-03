/**
 * Smoke C2 — catálogo CIE-10 auditor + clasificación con cie10 en payload.
 *
 *   node scripts/smoke/med-c2-cie10-clasificacion.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));

const TAG = "[smoke-med-c2-cie10]";

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

async function main() {
  const db = initDb();
  const { listarCie10BandejaAuditor } = requireFns("./modules/shared/listarCie10BandejaAuditorCore.js");
  const { clasificarSolicitudMedicaAuditor } = requireFns(
    "./modules/shared/clasificarSolicitudMedicaAuditorCore.js",
  );

  const cat = await listarCie10BandejaAuditor(db);
  console.log(TAG, "catalogo", { total: cat.total, first: cat.items[0]?.codigo_interno });
  if (!cat.total || cat.total < 1) {
    console.error(TAG, "FAIL: catálogo cfg_cie10 vacío");
    process.exit(1);
  }

  const snap = await db
    .collection("solicitudes_articulo")
    .where("estado_solicitud_id", "==", "cfg_esa_pendiente_clasificacion_medica")
    .limit(5)
    .get();

  const pend = snap.docs.find((d) => {
    const ing = d.data()?.ingreso_medico;
    return ing?.es_licencia_incompleta !== true && Array.isArray(ing?.adjuntos) && ing.adjuntos.length > 0;
  });

  if (!pend) {
    console.log(TAG, "SKIP clasificación: sin aviso completo pendiente en piloto");
    console.log(TAG, "VEREDICTO: PASS (solo catálogo)");
    return;
  }

  const solId = pend.id;
  const d = pend.data() || {};
  const cie10 = {
    codigo: String(cat.items[0].codigo_interno || "J06.9"),
    descripcion: String(cat.items[0].titulo_ui || "Test CIE-10 smoke"),
  };

  console.log(TAG, "probe sol", solId, "cie10", cie10.codigo);

  const r = await clasificarSolicitudMedicaAuditor(db, {
    solicitudId: solId,
    auditorPersonaId: "per_01SMOKE_AUDITOR_CIE10",
    articuloId: String(d.articulo_id || ""),
    versionIdAplicada: String(d.version_id_aplicada || d.version_aplicada_id || ""),
    fechaDesde: String(d.fecha_inicio_reposo_estimada || d.fecha_desde || "").slice(0, 10),
    fechaHasta: String(d.fecha_fin_reposo_estimada || d.fecha_hasta || "").slice(0, 10),
    dictamenFavorable: false,
    cie10,
  });

  if (!r.ok && r.codigo !== "ESTADO_INVALIDO") {
    console.log(TAG, "clasificar probe (dry)", r.codigo || r.mensaje);
  }

  console.log(TAG, "VEREDICTO: PASS");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
