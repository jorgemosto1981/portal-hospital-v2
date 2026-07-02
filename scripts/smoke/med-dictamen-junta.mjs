/**
 * Smoke piloto — dictamen junta médica (P4.2) sobre aviso Caja Negra.
 *
 * Uso:
 *   node scripts/smoke/med-dictamen-junta.mjs --dry-run
 *   node scripts/smoke/med-dictamen-junta.mjs --apply --solicitud=sol_... [--favorable]
 *   node scripts/smoke/med-dictamen-junta.mjs --apply --solicitud=sol_... --desfavorable
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
const {
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = requireRepo(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));

const TAG = "[smoke-med-dictamen-junta]";
const EST_JUNTA = "cfg_esa_esperando_dictamen_junta";
const EST_APROB = "cfg_esa_aprobada";
const EST_RECH = "cfg_esa_rechazada";
const PERSONA_PILOTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const REGISTRANTE = PERSONA_PILOTO;

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
  const out = { dryRun: true, favorable: true };
  for (const a of argv) {
    if (a === "--apply") out.dryRun = false;
    else if (a === "--desfavorable") out.favorable = false;
    else if (a === "--favorable") out.favorable = true;
    else if (a.startsWith("--solicitud=")) out.solicitud = a.slice("--solicitud=".length).trim();
  }
  return out;
}

function initDb() {
  const { cert, getApps, initializeApp } = requireFns("firebase-admin/app");
  const { getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) {
    throw new Error(`Falta GOOGLE_APPLICATION_CREDENTIALS (${gacPath || "sin path"})`);
  }
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return { db: getFirestore() };
}

async function listarEnJunta(db) {
  const q = await db.collection("solicitudes_articulo").where("estado_solicitud_id", "==", EST_JUNTA).limit(25).get();
  return q.docs.map((doc) => {
    const d = doc.data();
    return {
      solicitudId: doc.id,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_desde,
      fechaHasta: d.fecha_hasta,
      gdt: d.grupo_trabajo_id_ancla,
    };
  });
}

function eventoTieneSol(eventos, solId) {
  return (Array.isArray(eventos) ? eventos : []).some(
    (e) => String(e?.solicitud_id || e?.sol_id || "") === solId,
  );
}

async function leerEstadoGrilla(db, candidato, solId) {
  const ymd = String(candidato.fechaDesde || "").slice(0, 10);
  const asiId = buildAsiDocumentId(candidato.titular, ymd);
  const visId = buildVisDocumentId(candidato.titular, ymd, candidato.gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  const [asiSnap, visSnap, solSnap] = await Promise.all([
    asiId ? db.collection("asistencia_diaria").doc(asiId).get() : null,
    visId ? db.collection("vistas_grilla_mes_agente").doc(visId).get() : null,
    db.collection("solicitudes_articulo").doc(solId).get(),
  ]);
  const asi = asiSnap?.exists ? asiSnap.data() : null;
  const vis = visSnap?.exists ? visSnap.data() : null;
  const sol = solSnap.exists ? solSnap.data() : null;
  return {
    sol_estado: sol?.estado_solicitud_id,
    tiene_licencia_medica: Boolean(sol?.licencia_medica),
    tiene_dictamen_junta: Boolean(sol?.junta_medica_dictamen),
    asi_id: asiId,
    tiene_aporte: asi?.aportes_normativos?.[solId] != null,
    vis_id: visId,
    chip_en_vis: eventoTieneSol(vis?.dias?.[diaKey]?.eventos, solId),
    mdc_ultimo_comando: sol?.mdc_ultimo_comando,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db } = initDb();
  const { registrarDictamenJuntaMedica } = requireRepo(
    join(repoRoot, "functions/modules/shared/registrarDictamenJuntaMedicaCore.js"),
  );

  let candidato = null;
  if (args.solicitud) {
    const snap = await db.collection("solicitudes_articulo").doc(args.solicitud).get();
    if (!snap.exists) throw new Error(`No existe ${args.solicitud}`);
    const d = snap.data();
    candidato = {
      solicitudId: snap.id,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_desde,
      fechaHasta: d.fecha_hasta,
      gdt: d.grupo_trabajo_id_ancla,
    };
  } else {
    const lista = await listarEnJunta(db);
    if (lista.length) candidato = lista[0];
    else {
      console.log(TAG, "Sin solicitudes en esperando junta.", { count: 0 });
      process.exit(args.dryRun ? 0 : 1);
    }
  }

  const solId = candidato.solicitudId;
  const antes = await leerEstadoGrilla(db, candidato, solId);
  console.log(TAG, "ANTES", { solId, favorable: args.favorable, antes });

  if (args.dryRun) {
    console.log(TAG, "dry-run OK — usar --apply para registrar dictamen");
    process.exit(0);
  }

  if (antes.sol_estado !== EST_JUNTA) {
    throw new Error(`Estado inicial inválido: ${antes.sol_estado}`);
  }

  const result = await registrarDictamenJuntaMedica(db, {
    solicitudId: solId,
    registradoPorPersonaId: REGISTRANTE,
    dictamenFavorable: args.favorable,
    observacionJunta: `Smoke piloto dictamen junta (${args.favorable ? "favorable" : "desfavorable"})`,
  });

  await sleep(800);
  const despues = await leerEstadoGrilla(db, candidato, solId);
  const estadoEsperado = args.favorable ? EST_APROB : EST_RECH;
  const checks = {
    estado_ok: despues.sol_estado === estadoEsperado,
    dictamen_meta: despues.tiene_dictamen_junta === true,
    mdc_ok: result.mdc_mutacion?.ok === true,
    licencia_si_favorable: args.favorable ? despues.tiene_licencia_medica === true : true,
    chip_coherente: args.favorable ? despues.chip_en_vis === true : despues.chip_en_vis === false,
  };
  const allOk = result.ok === true && Object.values(checks).every(Boolean);

  console.log(TAG, "RESULT", result);
  console.log(TAG, "DESPUÉS", despues);
  console.log(TAG, "CHECKS", checks, allOk ? "PASS" : "FAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(TAG, err);
  process.exit(1);
});
