/**
 * Backfill Fase F — rematerializa un mes piloto por grupo y repuebla
 * `validacion_fichada_dia` (vía `persistirAnaliticaCumplimientoDia` en materializarGrupoMes).
 *
 * Requisito: código Fase C en `functions/` (ejecutar antes: node scripts/sync-shared-to-functions.mjs).
 * Credenciales: `.env.v2.local` → GOOGLE_APPLICATION_CREDENTIALS (mismo patrón que otros scripts Admin).
 *
 * Uso:
 *   node scripts/backfill_fase_f_validacion.mjs
 *   node scripts/backfill_fase_f_validacion.mjs --gdt=gdt_... --periodo=2026-06
 *   node scripts/backfill_fase_f_validacion.mjs --solo-auditoria --gdt=gdt_... --periodo=2026-06
 *   node scripts/backfill_fase_f_validacion.mjs --gdt=gdt_... --persona=per_... --fecha=2026-06-14
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// --- Piloto: Sala Internación 1 · junio 2026 (CLI --gdt / --periodo tienen prioridad) ---
const GRUPO_ID = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const ANIO = 2026;
const MES = 6;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const COL_VIS = "vistas_grilla_mes_agente";
const { fusionarDiasDesdeClavesPlanas } = require(
  join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
);

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        const val = t.split("=")[1]?.trim() ?? "";
        return val.replace(/^["']|["']$/g, "");
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function parseArgs(argv) {
  const out = {
    gdt: "",
    periodo: "",
    soloAuditoria: false,
    persona: "",
    fecha: "",
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--solo-auditoria") out.soloAuditoria = true;
    if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    if (arg.startsWith("--periodo=")) out.periodo = arg.slice(10).trim();
    if (arg.startsWith("--persona=")) out.persona = arg.slice(10).trim();
    if (arg.startsWith("--fecha=")) out.fecha = arg.slice(8).trim();
  }
  return out;
}

function contarValidacionEnVisDoc(data) {
  const dias = fusionarDiasDesdeClavesPlanas(data && typeof data === "object" ? data : {});
  let conValidacion = 0;
  let sinValidacion = 0;
  const porSemaforo = { VERDE: 0, AMARILLO: 0, ROJO: 0, OTRO: 0 };
  for (const key of Object.keys(dias)) {
    const v = dias[key]?.validacion_fichada_dia;
    if (!v || typeof v !== "object") {
      sinValidacion += 1;
      continue;
    }
    conValidacion += 1;
    const s = String(v.estado_semaforo || "").toUpperCase();
    if (s in porSemaforo) porSemaforo[s] += 1;
    else porSemaforo.OTRO += 1;
  }
  return { conValidacion, sinValidacion, porSemaforo, diasTotales: Object.keys(dias).length };
}

async function auditarVisGrupoMes(db, grupoId, anio, mes) {
  const snap = await db
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("anio", "==", anio)
    .where("mes", "==", mes)
    .get();

  const porAgente = [];
  const totales = {
    documentos_vis: snap.size,
    dias_con_validacion: 0,
    dias_sin_validacion: 0,
    semaforo: { VERDE: 0, AMARILLO: 0, ROJO: 0, OTRO: 0 },
  };

  for (const doc of snap.docs) {
    const d = doc.data();
    const c = contarValidacionEnVisDoc(d);
    totales.dias_con_validacion += c.conValidacion;
    totales.dias_sin_validacion += c.sinValidacion;
    for (const k of Object.keys(totales.semaforo)) {
      totales.semaforo[k] += c.porSemaforo[k] || 0;
    }
    porAgente.push({
      vis_id: doc.id,
      persona_id: d.persona_id || null,
      dias_en_doc: c.diasTotales,
      con_validacion_fichada_dia: c.conValidacion,
      sin_validacion: c.sinValidacion,
      semaforo: c.porSemaforo,
    });
  }

  return { totales, porAgente };
}

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_ASISTENCIA = "asistencia_diaria";

/**
 * Re-persiste analítica + validación en vis_* (días con fichada o expectativa).
 * La materialización del mes no siempre reescribe `analitica_cumplimiento` en celdas ya cargadas.
 */
async function refrescarAnaliticaValidacionVisMes(db, grupoId, anio, mes) {
  const { leerCeldaVisDiaFusionada, fusionarDiasDesdeClavesPlanas } = require(
    join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
  );
  const { enriquecerLimitesCumplimientoEnCapa } = require(
    join(repoRoot, "functions/modules/shared/capaTeoricaLimitesCumplimiento.js"),
  );
  const { resolverCapaTeoricaGrupo } = require(
    join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"),
  );
  const { buildAsiDocumentId } = require(
    join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
  );
  const {
    ejecutarAnaliticaYValidacionFichadaDia,
    dotPathValidacionFichadaDia,
  } = require(join(repoRoot, "functions/modules/shared/validacionFichadaDiaPersistencia.js"));
  const { parseFichadasRealesCelda, celdaEsperaFichada } = require(
    join(repoRoot, "functions/modules/shared/grillaFichadaPresencia.js"),
  );

  const snap = await db
    .collection(COL_VIS)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("anio", "==", anio)
    .where("mes", "==", mes)
    .get();

  const regimenCache = new Map();
  let celdasRefrescadas = 0;

  for (const visDoc of snap.docs) {
    const visData = visDoc.data();
    const personaId = String(visData.persona_id || "").trim();
    if (!/^per_/i.test(personaId)) continue;

    let regimenDoc = regimenCache.get(personaId);
    if (regimenDoc === undefined) {
      const hlgSnap = await db
        .collection(COL_HLG)
        .where("persona_id", "==", personaId)
        .where("grupo_de_trabajo_id", "==", grupoId)
        .where("activo", "==", true)
        .limit(1)
        .get();
      const rid = hlgSnap.docs[0]?.data()?.regimen_horario_id;
      if (rid) {
        const regSnap = await db.collection(COL_REGIMEN).doc(rid).get();
        regimenDoc = regSnap.exists ? regSnap.data() : null;
      } else {
        regimenDoc = null;
      }
      regimenCache.set(personaId, regimenDoc);
    }

    const dias = fusionarDiasDesdeClavesPlanas(visData);
    for (const diaKey of Object.keys(dias)) {
      const celdaRaw = leerCeldaVisDiaFusionada(visData, diaKey);
      if (!celdaRaw || typeof celdaRaw !== "object") continue;

      const tieneMarcas = parseFichadasRealesCelda(celdaRaw).length > 0;
      const esperaFichada = celdaEsperaFichada(celdaRaw);
      if (!tieneMarcas && !esperaFichada && !celdaRaw.analitica_cumplimiento) continue;

      const diaNum = String(diaKey).replace(/^d/i, "");
      const fechaYmd = `${anio}-${String(mes).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
      const { obtenerYmdHoyInstitucional } = require(
        join(repoRoot, "functions/modules/shared/fechaInstitucionalBa.js"),
      );
      if (fechaYmd > obtenerYmdHoyInstitucional()) {
        const valPath = dotPathValidacionFichadaDia(diaKey);
        const purge = {};
        if (celdaRaw.analitica_cumplimiento) {
          purge[`dias.${diaKey}.analitica_cumplimiento`] = FieldValue.delete();
        }
        if (celdaRaw.validacion_fichada_dia) {
          purge[valPath] = FieldValue.delete();
        }
        if (Object.keys(purge).length > 0) {
          await visDoc.ref.update(purge);
          celdasRefrescadas += 1;
        }
        continue;
      }
      const asiId = buildAsiDocumentId(personaId, fechaYmd);
      if (!asiId) continue;

      const asiSnap = await db.collection(COL_ASISTENCIA).doc(asiId).get();
      const capaEscrita = asiSnap.exists
        ? resolverCapaTeoricaGrupo(asiSnap.data(), grupoId)
        : null;
      const capaEnriquecida = enriquecerLimitesCumplimientoEnCapa(capaEscrita || {}, regimenDoc);

      const celdaCtx = {
        ...celdaRaw,
        tipo_dia: celdaRaw.tipo_dia ?? capaEnriquecida.tipo_dia,
        fichadas_esperadas: celdaRaw.fichadas_esperadas ?? capaEnriquecida.fichadas_esperadas,
        fichadas_reales: celdaRaw.fichadas_reales,
        rda_turno_id: celdaRaw.rda_turno_id,
        rda_ingreso: celdaRaw.rda_ingreso,
        rda_egreso: celdaRaw.rda_egreso,
      };

      const { analitica, resolverOut } = ejecutarAnaliticaYValidacionFichadaDia({
        celdaCtx,
        celdaRaw,
        capaEnriquecida,
        fecha_ymd: fechaYmd,
        forzar_recalculo: true,
      });
      if (!analitica) continue;

      const visUpdate = { [`dias.${diaKey}.analitica_cumplimiento`]: analitica };
      await visDoc.ref.update(visUpdate);

      const valPath = dotPathValidacionFichadaDia(diaKey);
      const accion = String(resolverOut?.accion || "");
      if (accion === "write" && resolverOut.validacion_fichada_dia) {
        await visDoc.ref.update({ [valPath]: resolverOut.validacion_fichada_dia });
      } else if (accion === "delete") {
        await visDoc.ref.update({ [valPath]: FieldValue.delete() });
      }
      if (asiSnap.exists) {
        await db
          .collection(COL_ASISTENCIA)
          .doc(asiId)
          .set({ [`analitica_cumplimiento_por_grupo.${grupoId}`]: analitica }, { merge: true });
      }
      celdasRefrescadas += 1;
    }
  }

  return celdasRefrescadas;
}

/**
 * Una celda: rematerializa teoría del día + analítica + validacion_fichada_dia.
 */
async function backfillValidacionUnaCelda(db, grupoId, personaId, fechaYmd) {
  const {
    materializarTurnoTeoricoDia,
    recalcularAnaliticaValidacionFichadaTrasTeoria,
  } = require(join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"));
  const { buildVisDocumentId, diaMesKeyDesdeYmd } = require(
    join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
  );
  const { leerCeldaVisDiaFusionada } = require(
    join(repoRoot, "functions/modules/shared/visCeldaFusionLectura.js"),
  );

  console.log("\n[celda] materializarTurnoTeoricoDia…");
  const mat = await materializarTurnoTeoricoDia({
    personaId,
    grupoId,
    fechaYmd,
  });
  console.log(mat);

  console.log("[celda] recalcularAnaliticaValidacionFichadaTrasTeoria…");
  const rec = await recalcularAnaliticaValidacionFichadaTrasTeoria({
    personaId,
    grupoId,
    fechaYmd,
  });
  console.log(rec);

  const visId = buildVisDocumentId(personaId, fechaYmd, grupoId);
  const visSnap = await db.collection(COL_VIS).doc(visId).get();
  const diaKey = diaMesKeyDesdeYmd(fechaYmd);
  const celda = visSnap.exists ? leerCeldaVisDiaFusionada(visSnap.data(), diaKey) : null;
  const val = celda?.validacion_fichada_dia;
  const analitica = celda?.analitica_cumplimiento;

  return {
    vis_id: visId,
    dia_key: diaKey,
    materializacion: mat,
    recalculo: rec,
    estado_semaforo: val?.estado_semaforo ?? null,
    alertas: val?.alertas_semanticas ?? null,
    texto_resumen: val?.texto_resumen ?? null,
    fichada_fuera_turno: analitica?.fichada_fuera_turno_teorico === true,
  };
}

function initFirebaseAdmin() {
  const gac = loadGacPath();
  if (!gac || !existsSync(gac)) {
    console.error(
      "[backfill-fase-f] Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local o ruta inválida.",
    );
    process.exit(1);
  }
  if (!getApps().length) {
    const cred = JSON.parse(readFileSync(gac, "utf8"));
    process.env.GCLOUD_PROJECT =
      process.env.GCLOUD_PROJECT || cred.project_id || "portal-hospital-v2";
    initializeApp({ credential: cert(cred) });
  }
  return getFirestore();
}

const args = parseArgs(process.argv);
const grupoId = args.gdt || GRUPO_ID;
const periodoStr =
  args.periodo
  || (args.fecha && /^\d{4}-\d{2}-\d{2}$/.test(args.fecha) ? args.fecha.slice(0, 7) : "")
  || `${ANIO}-${String(MES).padStart(2, "0")}`;

if (args.persona && !/^per_/i.test(args.persona)) {
  console.error("[backfill-fase-f] --persona debe ser per_*");
  process.exit(1);
}
if (args.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(args.fecha)) {
  console.error("[backfill-fase-f] --fecha debe ser YYYY-MM-DD");
  process.exit(1);
}
if ((args.persona && !args.fecha) || (!args.persona && args.fecha)) {
  console.error("[backfill-fase-f] Usá --persona y --fecha juntos para backfill puntual.");
  process.exit(1);
}

if (!/^gdt_/i.test(grupoId) || !/^\d{4}-\d{2}$/.test(periodoStr)) {
  console.error(
    "Uso: node scripts/backfill_fase_f_validacion.mjs [--gdt=gdt_...] [--periodo=YYYY-MM] [--solo-auditoria]",
  );
  console.error(
    "     node scripts/backfill_fase_f_validacion.mjs --gdt=gdt_... --persona=per_... --fecha=YYYY-MM-DD",
  );
  console.error("  O editá GRUPO_ID / ANIO / MES al inicio del script.");
  process.exit(1);
}

const [anioStr, mesStr] = periodoStr.split("-");
const anio = Number(anioStr);
const mes = Number(mesStr);

const db = initFirebaseAdmin();

console.log("═══════════════════════════════════════════════════════════");
console.log(" Fase F — Backfill validacion_fichada_dia (mes piloto)");
console.log("═══════════════════════════════════════════════════════════");
console.log({
  proyecto: process.env.GCLOUD_PROJECT,
  grupo_id: grupoId,
  periodo: periodoStr,
  solo_auditoria: args.soloAuditoria,
  persona: args.persona || null,
  fecha: args.fecha || null,
});

if (args.persona && args.fecha) {
  console.log("\n Modo celda única — validación fichada");
  const out = await backfillValidacionUnaCelda(db, grupoId, args.persona, args.fecha);
  console.log("\n--- Resultado celda ---");
  console.log(JSON.stringify(out, null, 2));
  console.log("\n[backfill-fase-f] Listo.");
  process.exit(0);
}

if (!args.soloAuditoria) {
  const { materializarGrupoMes } = require(
    join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
  );

  console.log("\n[1/2] materializarGrupoMes (teoría + analítica + validacion_fichada_dia)…");
  const t0 = Date.now();
  let result;
  try {
    result = await materializarGrupoMes({
      grupoId,
      anio,
      mes,
      materializacionMotivo: "backfill_fase_f_validacion",
    });
  } catch (e) {
    console.error("[backfill-fase-f] Error fatal en materializarGrupoMes:", e);
    process.exit(1);
  }
  const elapsedMs = Date.now() - t0;

  console.log("\n--- Resultado materialización ---");
  console.log({
    ok: result.ok,
    dias_procesados_agregado: result.procesados,
    agentes_con_fallo: result.fallos?.length ?? 0,
    elapsed_ms: elapsedMs,
  });

  if (result.fallos?.length) {
    console.error("\nFallos por agente:");
    for (const f of result.fallos) {
      console.error(`  • ${f.personaId}: ${f.error}`);
    }
  }

  if (!result.ok) {
    console.error("\n[backfill-fase-f] Terminó con fallos. Revisá logs arriba.");
    process.exit(1);
  }

  console.log("\n[1b/2] Refresco analítica + validación en vis_* (forzar recálculo)…");
  const t1 = Date.now();
  const refrescados = await refrescarAnaliticaValidacionVisMes(db, grupoId, anio, mes);
  console.log({ celdas_refrescadas: refrescados, elapsed_ms: Date.now() - t1 });
} else {
  console.log("\n[1/2] Omitido (--solo-auditoria)");
}

console.log("\n[2/2] Auditoría vis_* (validacion_fichada_dia persistido)…");
const audit = await auditarVisGrupoMes(db, grupoId, anio, mes);

console.log("\n--- Totales auditoría ---");
console.log(JSON.stringify(audit.totales, null, 2));

if (audit.porAgente.length === 0) {
  console.warn(
    "[backfill-fase-f] No hay documentos vis_* para este gdt/mes. ¿HLg activos en el grupo?",
  );
} else {
  console.log(`\nAgentes con vis_* en el mes: ${audit.porAgente.length}`);
  for (const row of audit.porAgente) {
    console.log(
      `  ${row.persona_id || "?"} | días doc=${row.dias_en_doc} | con validación=${row.con_validacion_fichada_dia} | V/A/R=${row.semaforo.VERDE}/${row.semaforo.AMARILLO}/${row.semaforo.ROJO}`,
    );
  }
}

console.log("\n[backfill-fase-f] Listo. Abrí la grilla del jefe para QA visual del semáforo.");
console.log("═══════════════════════════════════════════════════════════\n");
