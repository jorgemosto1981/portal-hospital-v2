/**
 * Smoke piloto — clasificar aviso >15 días → esperando junta (UAT P4.2).
 *
 * Uso:
 *   node scripts/smoke/med-clasificar-junta.mjs --dry-run
 *   node scripts/smoke/med-clasificar-junta.mjs --apply
 *   node scripts/smoke/med-clasificar-junta.mjs --apply --solicitud=sol_...
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

const TAG = "[smoke-med-clasificar-junta]";
const EST_PEND = "cfg_esa_pendiente_clasificacion_medica";
const EST_JUNTA = "cfg_esa_esperando_dictamen_junta";
const PERSONA_PILOTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const AUDITOR = PERSONA_PILOTO;
const DIAS_REPOSO = 18;

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
  const { FieldValue, getFirestore } = requireFns("firebase-admin/firestore");
  const gacPath = loadGacPath();
  if (!gacPath || !existsSync(gacPath)) {
    throw new Error(`Falta GOOGLE_APPLICATION_CREDENTIALS (${gacPath || "sin path"})`);
  }
  const gac = JSON.parse(readFileSync(gacPath, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(gac), projectId: gac.project_id || "portal-hospital-v2" });
  }
  return { db: getFirestore(), FieldValue };
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

async function resolverArticuloMedicoCorta(db) {
  const appliedPath = join(repoRoot, "docs/v2/seeds/p4_art14/applied-ids.json");
  if (existsSync(appliedPath)) {
    try {
      const applied = JSON.parse(readFileSync(appliedPath, "utf8"));
      const art14 = applied?.articulos?.art14_corta;
      if (art14?.artId && art14?.verId) {
        return {
          articuloId: art14.artId,
          versionId: art14.verId,
          codigo: art14.codigo || "14",
        };
      }
    } catch {
      /* ignore */
    }
  }

  const byCodigo = await db.collection("cfg_articulos").where("codigo", "==", "14").limit(1).get();
  if (!byCodigo.empty) {
    const artDoc = byCodigo.docs[0];
    const core = artDoc.data() || {};
    const verId = String(core.version_actual_id || "").trim();
    if (/^ver_/i.test(verId)) {
      return { articuloId: artDoc.id, versionId: verId, codigo: "14" };
    }
  }

  const arts = await db.collection("cfg_articulos").limit(80).get();
  for (const artDoc of arts.docs) {
    const verSnap = await artDoc.ref.collection("versiones").orderBy("vigente_desde", "desc").limit(5).get();
    for (const ver of verSnap.docs) {
      const vd = ver.data() || {};
      const ident = vd.bloque_identidad_naturaleza || vd.identidad || {};
      if (ident.es_licencia_medica === true) {
        const modo = String(ident.modo_licencia_medica_id || "").trim();
        if (modo === "cfg_mlm_corta_anual" || modo === "") {
          return { articuloId: artDoc.id, versionId: ver.id, codigo: ident.codigo_normativo || artDoc.id };
        }
      }
    }
  }

  /** Piloto sin ficha médica sembrada: no mutar artículos reales (evita contaminar 64-A, etc.). */
  console.error(TAG, "ERROR: no hay artículo Art. 14 publicado con es_licencia_medica para smoke UAT");
  return null;
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

async function crearFixture(db, FieldValue, personaId, proyectarAvisoMedicoEnGrilla) {
  const gdt = await resolverGdtAncla(db, personaId);
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  const fechaDesde = `${y}-${m}-${d}`;
  const fechaHasta = addDaysYmd(fechaDesde, DIAS_REPOSO - 1);
  const solId = `sol_01${randomBytes(12).toString("hex").toUpperCase().slice(0, 26)}`;

  const doc = {
    schema_version: "SOL_MED_AVISO_V1",
    estado_solicitud_id: EST_PEND,
    titular_persona_id: personaId,
    grupo_trabajo_id_ancla: gdt,
    fecha_inicio_reposo_estimada: fechaDesde,
    fecha_fin_reposo_estimada: fechaHasta,
    ingreso_medico: {
      tipo_ingreso_medico_id: "cfg_tig_enfermedad_propia",
      es_licencia_incompleta: false,
      adjuntos: [
        {
          storage_path: `smoke/${solId}/certificado.pdf`,
          content_type: "application/pdf",
          nombre_archivo: "smoke-cert.pdf",
        },
      ],
      declaracion_clinica: { sintomas: `Smoke junta ${DIAS_REPOSO}d` },
      declaracion_contacto: {
        usar_datos_perfil: false,
        telefono_celular: "2996000001",
        domicilio_declarado: "Smoke Junta 123",
        permanece_en_domicilio: true,
        usar_email_perfil: false,
        email: "smoke-junta@test.local",
      },
    },
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

  await db.collection("solicitudes_articulo").doc(solId).set(doc);
  await sleep(500);
  const proj = await proyectarAvisoMedicoEnGrilla(db, solId, { id: solId, ...doc });
  if (proj?.ok !== true) throw new Error(`Proyección falló: ${proj?.codigo}`);

  return { solicitudId: solId, titular: personaId, fechaDesde, fechaHasta, gdt };
}

function eventoTieneSol(eventos, solId) {
  return (Array.isArray(eventos) ? eventos : []).some(
    (e) => String(e?.solicitud_id || e?.sol_id || "") === solId,
  );
}

async function leerEstado(db, cand, solId) {
  const ymd = String(cand.fechaDesde || "").slice(0, 10);
  const asiId = buildAsiDocumentId(cand.titular, ymd);
  const visId = buildVisDocumentId(cand.titular, ymd, cand.gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  const [asiSnap, visSnap, solSnap] = await Promise.all([
    db.collection("asistencia_diaria").doc(asiId).get(),
    db.collection("vistas_grilla_mes_agente").doc(visId).get(),
    db.collection("solicitudes_articulo").doc(solId).get(),
  ]);
  const sol = solSnap.data() || {};
  const asi = asiSnap.exists ? asiSnap.data() : null;
  const vis = visSnap.exists ? visSnap.data() : null;
  return {
    sol_estado: sol.estado_solicitud_id,
    requiere_junta: sol.auditor_medico_clasificacion?.requiere_junta_medica,
    dias: sol.dias_solicitados,
    tiene_licencia: Boolean(sol.licencia_medica),
    chip_vis: eventoTieneSol(vis?.dias?.[diaKey]?.eventos, solId),
    tiene_aporte: asi?.aportes_normativos?.[solId] != null,
    mdc_cmd: sol.mdc_ultimo_comando,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, FieldValue } = initDb();
  const art = await resolverArticuloMedicoCorta(db);
  if (!art) throw new Error("No hay cfg_articulos/versiones en piloto");

  const { clasificarSolicitudMedicaAuditor } = requireRepo(
    join(repoRoot, "functions/modules/shared/clasificarSolicitudMedicaAuditorCore.js"),
  );
  const { proyectarAvisoMedicoEnGrilla } = requireRepo(
    join(repoRoot, "functions/modules/shared/avisoMedicoGrillaMdcCore.js"),
  );

  let cand = null;
  if (args.solicitud) {
    const snap = await db.collection("solicitudes_articulo").doc(args.solicitud).get();
    if (!snap.exists) throw new Error("solicitud no existe");
    const d = snap.data();
    cand = {
      solicitudId: snap.id,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_desde || d.fecha_inicio_reposo_estimada,
      fechaHasta: d.fecha_hasta || d.fecha_fin_reposo_estimada,
      gdt: d.grupo_trabajo_id_ancla,
    };
  }

  console.log(TAG, "articulo", art);
  if (args.dryRun) {
    console.log(TAG, "dry-run OK — --apply crea fixture y clasifica >15d");
    process.exit(0);
  }

  if (!cand) {
    cand = await crearFixture(db, FieldValue, PERSONA_PILOTO, proyectarAvisoMedicoEnGrilla);
    cand.fechaDesde = cand.fechaDesde;
    cand.fechaHasta = cand.fechaHasta;
  } else if (cand.solicitudId && !cand.fechaHasta) {
    const snap = await db.collection("solicitudes_articulo").doc(cand.solicitudId).get();
    const d = snap.data();
    cand.fechaDesde = d.fecha_inicio_reposo_estimada || d.fecha_desde;
    cand.fechaHasta = d.fecha_fin_reposo_estimada || d.fecha_hasta;
  }

  const solId = cand.solicitudId;
  const antes = await leerEstado(db, cand, solId);
  console.log(TAG, "ANTES clasificar", { solId, antes });

  const clasif = await clasificarSolicitudMedicaAuditor(db, {
    solicitudId: solId,
    auditorPersonaId: AUDITOR,
    articuloId: art.articuloId,
    versionIdAplicada: art.versionId,
    fechaDesde: String(cand.fechaDesde).slice(0, 10),
    fechaHasta: String(cand.fechaHasta).slice(0, 10),
    dictamenFavorable: true,
    observacionAuditor: `Smoke UAT junta ${DIAS_REPOSO} días`,
  });

  await sleep(800);
  const despues = await leerEstado(db, cand, solId);
  const checks = {
    clasif_ok: clasif.ok === true,
    estado_junta: despues.sol_estado === EST_JUNTA,
    requiere_junta: despues.requiere_junta === true,
    sin_licencia: despues.tiene_licencia === false,
    chip_vis: despues.chip_vis === true,
    mdc_ok: clasif.mdc_mutacion?.ok === true,
    dias_gt_15: Number(despues.dias) > 15,
  };
  const pass = Object.values(checks).every(Boolean);
  console.log(TAG, "CLASIFICAR", clasif);
  console.log(TAG, "DESPUÉS", despues);
  console.log(TAG, "CHECKS", checks, pass ? "PASS" : "FAIL");
  if (!pass) process.exit(1);
  console.log(TAG, "SOL_ID_PARA_DICTAMEN", solId);
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
