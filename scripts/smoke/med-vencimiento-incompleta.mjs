/**
 * Smoke piloto — job §5.7 vencimiento aviso incompleto.
 *
 * Uso:
 *   node scripts/smoke/med-vencimiento-incompleta.mjs --dry-run
 *   node scripts/smoke/med-vencimiento-incompleta.mjs --apply
 *   node scripts/smoke/med-vencimiento-incompleta.mjs --apply --solicitud=sol_...
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const requireFns = createRequire(join(repoRoot, "functions/package.json"));
const requireRepo = createRequire(import.meta.url);
const {
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = requireRepo(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));

const TAG = "[smoke-med-vencimiento]";
const EST_PEND = "cfg_esa_pendiente_clasificacion_medica";
const EST_RECH = "cfg_esa_rechazada";
const PERSONA_PILOTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";

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

function parseArgs(argv) {
  const out = { dryRun: true };
  for (const a of argv) {
    if (a === "--apply") out.dryRun = false;
    else if (a.startsWith("--solicitud=")) out.solicitud = a.slice("--solicitud=".length).trim();
  }
  return out;
}

function initDb() {
  const { cert, getApps, initializeApp } = requireFns("firebase-admin/app");
  const { FieldValue, Timestamp, getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) {
    throw new Error(`Falta GOOGLE_APPLICATION_CREDENTIALS (${gacPath || "sin path"})`);
  }
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return { db: getFirestore(), FieldValue, Timestamp };
}

async function resolverGdtAncla(db, personaId) {
  const snap = await db
    .collection("historial_laboral_grupos")
    .where("persona_id", "==", personaId)
    .where("activo", "==", true)
    .limit(1)
    .get();
  if (!snap.empty) {
    const g = String(snap.docs[0].data()?.grupo_de_trabajo_id || "").trim();
    if (/^gdt_/i.test(g)) return g;
  }
  return "gdt_01KR3H81ENQK84ZK21EQWEQQXG";
}

async function crearFixtureIncompletaVencida(db, FieldValue, Timestamp, personaId, proyectar) {
  const gdt = await resolverGdtAncla(db, personaId);
  const hoy = new Date();
  const fechaDesde = hoy.toISOString().slice(0, 10);
  const solId = `sol_01${randomBytes(12).toString("hex").toUpperCase().slice(0, 26)}`;
  const venc = Timestamp.fromMillis(Date.now() - 3_600_000);

  const doc = {
    schema_version: "SOL_MED_AVISO_V1",
    patron_saldo: "MEDICO_AVISO",
    estado_solicitud_id: EST_PEND,
    titular_persona_id: personaId,
    actor_alta_persona_id: personaId,
    grupo_trabajo_id_ancla: gdt,
    articulo_id: null,
    version_id_aplicada: null,
    fecha_inicio_reposo_estimada: fechaDesde,
    fecha_fin_reposo_estimada: fechaDesde,
    vencimiento_plazo_certificado: venc,
    ingreso_medico: {
      modo: "caja_negra",
      tipo_ingreso_id: "cfg_tig_enfermedad_propia",
      es_licencia_incompleta: true,
      adjuntos: [],
      timestamp_aviso_incompleto: new Date().toISOString(),
      declaracion_contacto: {
        usar_datos_perfil: false,
        telefono_celular: "2996000099",
        domicilio_declarado: "Smoke vencimiento 1",
        permanece_en_domicilio: true,
        usar_email_perfil: false,
        email: "venc-smoke@test.local",
      },
    },
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

  await db.collection("solicitudes_articulo").doc(solId).set(doc);
  await sleep(500);
  const proj = await proyectar(db, solId, { id: solId, ...doc });
  if (proj?.ok !== true) throw new Error(`Proyección falló: ${proj?.codigo}`);

  return { solicitudId: solId, titular: personaId, fechaDesde, gdt };
}

function eventoTieneSol(eventos, solId) {
  return (Array.isArray(eventos) ? eventos : []).some(
    (e) => String(e?.solicitud_id || e?.sol_id || "") === solId,
  );
}

async function leerEstado(db, cand, solId) {
  const ymd = String(cand.fechaDesde || "").slice(0, 10);
  const visId = buildVisDocumentId(cand.titular, ymd, cand.gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  const [visSnap, solSnap] = await Promise.all([
    db.collection("vistas_grilla_mes_agente").doc(visId).get(),
    db.collection("solicitudes_articulo").doc(solId).get(),
  ]);
  const sol = solSnap.data() || {};
  const vis = visSnap.exists ? visSnap.data() : null;
  return {
    sol_estado: sol.estado_solicitud_id,
    motivo: sol.motivo_rechazo_id,
    chip_vis: eventoTieneSol(vis?.dias?.[diaKey]?.eventos, solId),
    mdc_cmd: sol.mdc_ultimo_comando,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, FieldValue, Timestamp } = initDb();
  const { procesarVencimientosLicenciaIncompleta, invalidarVencimientoIncompletaEnTransaccion } =
    requireRepo(join(repoRoot, "functions/modules/shared/procesarVencimientosLicenciaIncompletaCore.js"));
  const { proyectarAvisoMedicoEnGrilla } = requireRepo(
    join(repoRoot, "functions/modules/shared/avisoMedicoGrillaMdcCore.js"),
  );

  let solId = args.solicitud;
  let cand = null;

  if (!solId && !args.dryRun) {
    cand = await crearFixtureIncompletaVencida(
      db,
      FieldValue,
      Timestamp,
      PERSONA_PILOTO,
      proyectarAvisoMedicoEnGrilla,
    );
    solId = cand.solicitudId;
  } else if (solId) {
    const snap = await db.collection("solicitudes_articulo").doc(solId).get();
    const d = snap.data() || {};
    cand = {
      solicitudId: solId,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_inicio_reposo_estimada,
      gdt: d.grupo_trabajo_id_ancla,
    };
  }

  if (args.dryRun) {
    const r = await procesarVencimientosLicenciaIncompleta(db, { dryRun: true, batchSize: 10, maxPaginas: 1 });
    console.log(TAG, "dry-run job", r);
    process.exit(0);
  }

  if (!cand || !solId) throw new Error("Falta solicitud");

  const antes = await leerEstado(db, cand, solId);
  console.log(TAG, "ANTES", { solId, antes });

  let r;
  if (args.solicitud) {
    r = await invalidarVencimientoIncompletaEnTransaccion(db, solId);
  } else {
    try {
      r = await procesarVencimientosLicenciaIncompleta(db, { batchSize: 20, maxPaginas: 2 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("index") || msg.includes("FAILED_PRECONDITION")) {
        console.log(TAG, "WARN: índice en construcción — fallback invalidar transacción directa");
        r = await invalidarVencimientoIncompletaEnTransaccion(db, solId);
      } else {
        throw err;
      }
    }
  }

  await sleep(800);
  const despues = await leerEstado(db, cand, solId);

  const checks = {
    rechazada: despues.sol_estado === EST_RECH,
    motivo_doc: despues.motivo === "cfg_mrs_doc_incompleta",
    sin_chip: despues.chip_vis === false,
    mdc_revert: despues.mdc_cmd === "REVERTIR_PROYECCION",
    job_ok:
      r.outcome === "procesado" ||
      (r.procesados >= 1 && r.ok === true) ||
      (r.ok === true && r.estado_solicitud_id === EST_RECH),
  };
  const pass = Object.values(checks).every(Boolean);

  console.log(TAG, "RESULT", r);
  console.log(TAG, "DESPUÉS", despues);
  console.log(TAG, "CHECKS", checks, pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
