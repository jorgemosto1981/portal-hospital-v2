/**
 * Evidence collector — dictamen P2b con fechas corregidas (piloto).
 *
 * Uso:
 *   node scripts/smoke/med-p2b-evidence-dictamen.mjs --dry-run --solicitud=sol_...
 *   node scripts/smoke/med-p2b-evidence-dictamen.mjs --apply --solicitud=sol_...
 *   node scripts/smoke/med-p2b-evidence-dictamen.mjs --apply --solicitud=sol_... --desde=2026-07-21 --hasta=2026-07-21
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));
const requireRepo = createRequire(import.meta.url);

const TAG = "[smoke-med-p2b-evidence]";
const AUDITOR = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const EST_PEND = "cfg_esa_pendiente_clasificacion_medica";
const EST_APROB = "cfg_esa_aprobada";

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

function parseArgs(argv) {
  const out = { dryRun: true };
  for (const a of argv) {
    if (a === "--apply") out.dryRun = false;
    else if (a.startsWith("--solicitud=")) out.solicitud = a.slice("--solicitud=".length).trim();
    else if (a.startsWith("--desde=")) out.desde = a.slice("--desde=".length).trim();
    else if (a.startsWith("--hasta=")) out.hasta = a.slice("--hasta=".length).trim();
  }
  return out;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

async function resolverArticulo14(db) {
  const appliedPath = join(repoRoot, "docs/v2/seeds/p4_art14/applied-ids.json");
  if (existsSync(appliedPath)) {
    const applied = JSON.parse(readFileSync(appliedPath, "utf8"));
    const art14 = applied?.articulos?.art14_corta;
    if (art14?.artId && art14?.verId) {
      return { articuloId: art14.artId, versionId: art14.verId };
    }
  }
  const byCodigo = await db.collection("cfg_articulos").where("codigo", "==", "14").limit(1).get();
  if (!byCodigo.empty) {
    const artDoc = byCodigo.docs[0];
    const verId = String(artDoc.data()?.version_actual_id || "").trim();
    if (/^ver_/i.test(verId)) return { articuloId: artDoc.id, versionId: verId };
  }
  throw new Error("No se resolvió artículo 14 en piloto");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.solicitud) throw new Error("Indicá --solicitud=sol_...");
  const db = initDb();
  const snap = await db.collection("solicitudes_articulo").doc(args.solicitud).get();
  if (!snap.exists) throw new Error("Solicitud no encontrada");
  const d = snap.data();
  if (d.estado_solicitud_id !== EST_PEND) {
    throw new Error(`Estado esperado ${EST_PEND}, actual ${d.estado_solicitud_id}`);
  }

  const origDesde = String(d.fecha_inicio_reposo_estimada || "").slice(0, 10);
  const origHasta = String(d.fecha_fin_reposo_estimada || origDesde).slice(0, 10);
  const fechaDesde = args.desde || addDaysYmd(origDesde, -1);
  const fechaHasta = args.hasta || fechaDesde;
  const art = await resolverArticulo14(db);

  const plan = {
    solicitud_id: args.solicitud,
    origen_estimado: { desde: origDesde, hasta: origHasta },
    dictamen: { desde: fechaDesde, hasta: fechaHasta, articulo_id: art.articuloId },
  };
  console.log(TAG, "PLAN", plan);

  if (args.dryRun) {
    console.log(TAG, "dry-run OK — usar --apply");
    return;
  }

  const { clasificarSolicitudMedicaAuditor } = requireRepo(
    join(repoRoot, "functions/modules/shared/clasificarSolicitudMedicaAuditorCore.js"),
  );

  const res = await clasificarSolicitudMedicaAuditor(db, {
    solicitudId: args.solicitud,
    auditorPersonaId: AUDITOR,
    articuloId: art.articuloId,
    versionIdAplicada: art.versionId,
    fechaDesde,
    fechaHasta,
    grupoTrabajoIdAncla: String(d.grupo_trabajo_id_ancla || "").trim() || undefined,
    observacionAuditor: "UAT P2b evidence — fechas corregidas por auditor (smoke post-deploy)",
    dictamenFavorable: true,
  });

  await sleep(500);
  const post = (await db.collection("solicitudes_articulo").doc(args.solicitud).get()).data();
  const flag = post?.auditor_medico_clasificacion?.fechas_corregidas_por_auditor;
  const checks = {
    clasif_ok: res.ok === true,
    estado_aprobada: post.estado_solicitud_id === EST_APROB,
    fechas_corregidas: flag === true,
    fecha_desde_dictamen: post.fecha_desde === fechaDesde,
    fecha_hasta_dictamen: post.fecha_hasta === fechaHasta,
  };
  console.log(TAG, "CLASIFICAR", {
    ok: res.ok,
    estado: res.estado_solicitud_id,
    auditor_medico_clasificacion: res.auditor_medico_clasificacion,
  });
  console.log(TAG, "CHECKS", checks);
  const pass = Object.values(checks).every(Boolean);
  if (!pass) process.exit(1);
  console.log(TAG, "PASS — fechas_corregidas_por_auditor=true");
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
