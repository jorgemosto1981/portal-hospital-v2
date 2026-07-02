/**
 * Smoke piloto — rechazo auditor aviso médico (ítem 3a RFC Caja Negra).
 *
 * Uso:
 *   node scripts/smoke/med-aviso-rechazo-3a.mjs --dry-run
 *   node scripts/smoke/med-aviso-rechazo-3a.mjs --apply --solicitud=sol_...
 *   node scripts/smoke/med-aviso-rechazo-3a.mjs --apply   # elige candidato o crea fixture
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

const TAG = "[smoke-med-rechazo-3a]";
const EST_PEND = "cfg_esa_pendiente_clasificacion_medica";
const EST_RECH = "cfg_esa_rechazada";
const PERSONA_PILOTO = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const AUDITOR_PILOTO = PERSONA_PILOTO;

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
    else if (a.startsWith("--persona=")) out.persona = a.slice("--persona=".length).trim();
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

async function listarCandidatos(db, personaId) {
  const q = await db
    .collection("solicitudes_articulo")
    .where("estado_solicitud_id", "==", EST_PEND)
    .limit(40)
    .get();
  const out = [];
  for (const doc of q.docs) {
    const d = doc.data();
    if (d.schema_version !== "SOL_MED_AVISO_V1") continue;
    if (personaId && String(d.titular_persona_id || "") !== personaId) continue;
    const ing = d.ingreso_medico && typeof d.ingreso_medico === "object" ? d.ingreso_medico : {};
    const adj = Array.isArray(ing.adjuntos) ? ing.adjuntos : [];
    if (ing.es_licencia_incompleta === true || adj.length === 0) continue;
    out.push({
      solicitudId: doc.id,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_inicio_reposo_estimada || d.fecha_desde,
      fechaHasta: d.fecha_fin_reposo_estimada || d.fecha_hasta,
      gdt: d.grupo_trabajo_id_ancla,
    });
  }
  return out;
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
  return "gdt_01KQN9WXFXF69Z9DCT5YNJ3TG0";
}

async function crearFixtureAvisoCompleto(db, FieldValue, personaId, proyectarAvisoMedicoEnGrilla) {
  const gdt = await resolverGdtAncla(db, personaId);
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  const fechaDesde = `${y}-${m}-${d}`;
  const solId = `sol_01${randomBytes(12).toString("hex").toUpperCase().slice(0, 26)}`;

  const doc = {
    schema_version: "SOL_MED_AVISO_V1",
    estado_solicitud_id: EST_PEND,
    titular_persona_id: personaId,
    grupo_trabajo_id_ancla: gdt,
    fecha_inicio_reposo_estimada: fechaDesde,
    fecha_fin_reposo_estimada: fechaDesde,
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
      declaracion_clinica: { sintomas: "Smoke test rechazo 3a" },
      declaracion_contacto: {
        usar_datos_perfil: false,
        telefono_celular: "2996000000",
        domicilio_declarado: "Smoke 123",
        permanece_en_domicilio: true,
        usar_email_perfil: false,
        email: "smoke@test.local",
      },
    },
    creado_en: FieldValue.serverTimestamp(),
    actualizado_en: FieldValue.serverTimestamp(),
  };

  await db.collection("solicitudes_articulo").doc(solId).set(doc);
  await sleep(500);
  const proj = await proyectarAvisoMedicoEnGrilla(db, solId, { id: solId, ...doc });
  if (proj?.ok !== true) {
    throw new Error(`Proyección inicial falló: ${proj?.codigo || "unknown"}`);
  }

  return {
    solicitudId: solId,
    titular: personaId,
    fechaDesde,
    fechaHasta: fechaDesde,
    gdt,
  };
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
  const aporte = asi?.aportes_normativos?.[solId];
  const vis = visSnap?.exists ? visSnap.data() : null;
  const eventos = vis?.dias?.[diaKey]?.eventos;
  const sol = solSnap.exists ? solSnap.data() : null;

  return {
    sol_estado: sol?.estado_solicitud_id,
    tiene_auditor_clasificacion: Boolean(sol?.auditor_medico_clasificacion),
    asi_id: asiId,
    tiene_aporte: aporte != null,
    vis_id: visId,
    chip_en_vis: eventoTieneSol(eventos, solId),
    mdc_mutacion_ok: sol?.mdc_ultimo_resultado_ok,
    mdc_ultimo_comando: sol?.mdc_ultimo_comando,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, FieldValue } = initDb();
  const { clasificarSolicitudMedicaAuditor } = requireRepo(
    join(repoRoot, "functions/modules/shared/clasificarSolicitudMedicaAuditorCore.js"),
  );
  const { proyectarAvisoMedicoEnGrilla } = requireRepo(
    join(repoRoot, "functions/modules/shared/avisoMedicoGrillaMdcCore.js"),
  );
  const persona = args.persona || PERSONA_PILOTO;

  let candidato = null;
  if (args.solicitud) {
    const snap = await db.collection("solicitudes_articulo").doc(args.solicitud).get();
    if (!snap.exists) throw new Error(`No existe ${args.solicitud}`);
    const d = snap.data();
    candidato = {
      solicitudId: snap.id,
      titular: d.titular_persona_id,
      fechaDesde: d.fecha_inicio_reposo_estimada || d.fecha_desde,
      fechaHasta: d.fecha_fin_reposo_estimada || d.fecha_hasta,
      gdt: d.grupo_trabajo_id_ancla,
    };
  } else {
    const lista = await listarCandidatos(db, persona);
    if (lista.length) candidato = lista[0];
    else if (!args.dryRun) {
      console.log(TAG, "Sin candidato; creando fixture smoke…");
      candidato = await crearFixtureAvisoCompleto(db, FieldValue, persona, proyectarAvisoMedicoEnGrilla);
    } else {
      console.log(TAG, "dry-run: sin candidatos completos en pendiente clasificación.", { persona, count: 0 });
      process.exit(0);
    }
  }

  const solId = candidato.solicitudId;
  const antes = await leerEstadoGrilla(db, candidato, solId);
  console.log(TAG, "ANTES", { solId, candidato, antes });

  if (args.dryRun) {
    console.log(TAG, "dry-run OK — usar --apply para clasificar rechazo");
    process.exit(0);
  }

  if (antes.sol_estado !== EST_PEND) {
    throw new Error(`Estado inicial inválido: ${antes.sol_estado}`);
  }
  if (!antes.tiene_aporte || !antes.chip_en_vis) {
    console.log(TAG, "Reproyectando MDC inicial (alta histórica sin grilla)…");
    const snap = await db.collection("solicitudes_articulo").doc(solId).get();
    const proj = await proyectarAvisoMedicoEnGrilla(db, solId, { id: solId, ...snap.data() });
    if (proj?.ok !== true) throw new Error(`Proyección previa falló: ${proj?.codigo}`);
    await sleep(600);
    const rep = await leerEstadoGrilla(db, candidato, solId);
    console.log(TAG, "Tras reproyección", rep);
    if (!rep.tiene_aporte && !rep.chip_en_vis) {
      console.warn(TAG, "WARN: sigue sin proyección visible; el smoke validará solo sol_* + MDC rechazo");
    }
  }

  const clasif = await clasificarSolicitudMedicaAuditor(db, {
    solicitudId: solId,
    auditorPersonaId: AUDITOR_PILOTO,
    articuloId: "art_smoke_placeholder",
    versionIdAplicada: "ver_smoke_placeholder",
    fechaDesde: String(candidato.fechaDesde).slice(0, 10),
    fechaHasta: String(candidato.fechaHasta || candidato.fechaDesde).slice(0, 10),
    dictamenFavorable: false,
    observacionAuditor: "Smoke test piloto — rechazo ítem 3a",
  });

  await sleep(800);
  const despues = await leerEstadoGrilla(db, candidato, solId);

  const checks = {
    sol_rechazada: despues.sol_estado === EST_RECH,
    auditor_meta: despues.tiene_auditor_clasificacion === true,
    asi_sin_aporte: despues.tiene_aporte === false,
    vis_sin_chip: despues.chip_en_vis === false,
    mdc_ok: clasif.mdc_mutacion?.ok === true,
  };
  const allOk = Object.values(checks).every(Boolean);

  console.log(TAG, "CLASIFICAR", clasif);
  console.log(TAG, "DESPUÉS", despues);
  console.log(TAG, "CHECKS", checks, allOk ? "PASS" : "FAIL");

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(TAG, err);
  process.exit(1);
});
