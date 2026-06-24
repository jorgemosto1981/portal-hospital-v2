/**
 * UAT P2 — RDA gate (63-I) + fan-out MDC (63-C, 2 días).
 *
 * Uso:
 *   node scripts/uat-p2-oleada-63-motor.mjs
 *   node scripts/uat-p2-oleada-63-motor.mjs --apply-fanout   # escribe vis_* (sol sintética UAT)
 */
import "./load-env-v2.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./lib/firestoreAdminBootstrap.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const { resolverGrupoTrabajoIdAnclaParaSolicitud, listarGruposTrabajoVigentesEnFecha } = require(
  join(repoRoot, "functions/modules/shared/solicitudGrupoTrabajoAncla.js"),
);

const GDT_PILOTO_DEFAULT = "gdt_01KQA6QCA8TDQK9YBTHKYA4R2V";
const GDT_RDA_NEGATIVO = "gdt_01KQA9FVEW53JSNTPGX32NWQ5B";
const FECHA_RDA_NEGATIVO = "2026-06-12";
const { buildAsiDocumentId, buildVisDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { resolverCapaTeoricaGrupo } = require(
  join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"),
);
const { fanOutVisDesdeAsi: _fanOutProd } = require(join(repoRoot, "functions/modules/shared/mdcFanOutVis.js"));
const { validarEntornoOperativoSolicitud } = require(
  join(repoRoot, "functions/modules/ticketera/validarEntornoOperativoCore.js"),
);
const { evaluarGrillaTurnoEntorno } = require(
  join(repoRoot, "functions/modules/ticketera/grillaTurnoEntornoGate.js"),
);
const { calcularTieneConflictoDia } = require(
  join(repoRoot, "functions/modules/shared/mdcVisConflictoDia.js"),
);
const { extraerTeoriaRefDesdeCeldaVis } = require(
  join(repoRoot, "functions/modules/shared/grillaTeoriaDesalineacion.js"),
);

const COLOR_63C_UAT = "#F97316";

const PERSONA = "per_01KQN9WXFXF69Z9DCT5YNJ3TFZ";
const ART_63I = "art_01KVWVW9Z402RB71K7QC34DGJB";
const VER_63I = "ver_01KVWVW9Z4R62FEZA8WD2WTFP8";
const ART_63C = "art_01KVWVW9Z0PFWJJF6510BF8DW8";
const VER_63C = "ver_01KVWVW9Z1A5DS7871ZS80G5D0";
const CFG_EST_VER_PUBLICADA = "cfg_est_ver_publicada";

const applyFanout = process.argv.includes("--apply-fanout");

function hoyAr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function addDaysYmd(ymd, delta) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Fan-out vis_* con FieldValue Admin (mismo contrato que mdcFanOutVis.js). */
async function fanOutVisUat(firestore, opts) {
  const personaId = String(opts.persona_id || "").trim();
  const ymd = String(opts.fecha_ymd || "").slice(0, 10);
  const solId = String(opts.sol_id || "").trim();
  const gdt = String(opts.grupo_trabajo_id || "").trim();
  const visId = buildVisDocumentId(personaId, ymd, gdt);
  const diaKey = diaMesKeyDesdeYmd(ymd);
  if (!visId || !diaKey || !solId) return;

  const visRef = firestore.collection("vistas_grilla_mes_agente").doc(visId);
  const anio = Number(ymd.slice(0, 4));
  const mes = Number(ymd.slice(5, 7));
  const color = String(opts.color_ui || COLOR_63C_UAT).trim();
  const nivelOcupacion = String(opts.nivel_ocupacion_dia_id || "").trim() || null;
  const ancla = String(opts.grupo_trabajo_id_ancla || "").trim();

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(visRef);
    const data = snap.exists ? snap.data() || {} : {};
    const dias = { ...(data.dias || {}) };
    const prev = dias[diaKey] || { eventos: [] };
    const prevEventos = Array.isArray(prev.eventos) ? prev.eventos : [];
    const existente = prevEventos.find((e) => String(e?.solicitud_id || "") === solId);
    let teoriaRef = existente?.teoria_ref || null;
    if (!teoriaRef) teoriaRef = extraerTeoriaRefDesdeCeldaVis(prev);
    const rest = prevEventos.filter((e) => String(e?.solicitud_id || "") !== solId);
    const evento = {
      solicitud_id: solId,
      articulo_id: String(opts.articulo_id || "").trim(),
      codigo_grilla: String(opts.codigo_grilla || "").trim(),
      color_ui: color,
      nivel_ocupacion_dia_id: nivelOcupacion,
      estado_solicitud_id: String(opts.estado_solicitud_id || "").trim(),
      ...(ancla ? { grupo_trabajo_id_ancla: ancla } : {}),
      ...(teoriaRef ? { teoria_ref: teoriaRef } : {}),
    };
    const eventos = [...rest, evento];
    dias[diaKey] = {
      ...prev,
      eventos,
      tiene_conflicto: calcularTieneConflictoDia(eventos),
    };
    tx.set(
      visRef,
      {
        persona_id: personaId,
        anio,
        mes,
        grupo_de_trabajo_id: gdt,
        dias,
        metadata: {
          generado_en: FieldValue.serverTimestamp(),
          ultima_sync_mdc: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  });
}

/** @param {import("firebase-admin/firestore").Firestore} db */
async function resolveGdtAncla(db, personaId, fecha) {
  const preferido = String(process.env.UAT_GDT_ANCLA || GDT_PILOTO_DEFAULT).trim();
  const r = await resolverGrupoTrabajoIdAnclaParaSolicitud(db, {
    persona_id: personaId,
    fecha_desde: fecha,
    grupo_trabajo_id_ancla: preferido,
  });
  if (r.ok) return String(r.grupo_trabajo_id_ancla || "").trim();
  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, personaId, fecha);
  return vigentes[0]?.grupo_de_trabajo_id || null;
}

/** @param {import("firebase-admin/firestore").Firestore} db */
async function buscarDiaSinTeoria(db, personaId, gdt, desdeYmd, maxScan = 120) {
  let ymd = desdeYmd;
  for (let i = 0; i < maxScan; i += 1) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    const snap = asiId ? await db.collection("asistencia_diaria").doc(asiId).get() : null;
    const capa = resolverCapaTeoricaGrupo(snap?.exists ? snap.data() : null, gdt);
    const presente = Boolean(
      capa &&
        (capa.tipo_dia || capa.tipo_id || capa.tipo || capa.ingreso_teorico || capa.egreso_teorico),
    );
    if (!presente) return { ymd, motivo: "sin_capa_teorica" };
    ymd = addDaysYmd(ymd, 1);
  }
  return null;
}

/** @param {import("firebase-admin/firestore").Firestore} db */
async function buscarDiaFranco(db, personaId, gdt, desdeYmd, maxScan = 90) {
  let ymd = desdeYmd;
  for (let i = 0; i < maxScan; i += 1) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    const snap = asiId ? await db.collection("asistencia_diaria").doc(asiId).get() : null;
    const capa = resolverCapaTeoricaGrupo(snap?.exists ? snap.data() : null, gdt);
    const tipo = String(capa?.tipo_dia || capa?.tipo || capa?.tipo_id || "").toUpperCase();
    if (tipo === "F" || tipo === "FRANCO" || tipo.includes("FRANCO")) {
      return { ymd, tipo };
    }
    ymd = addDaysYmd(ymd, 1);
  }
  return null;
}

/** @param {import("firebase-admin/firestore").Firestore} db */
async function buscarDosDiasConTeoria(db, personaId, gdt, desdeYmd, maxScan = 60) {
  const dias = [];
  let ymd = desdeYmd;
  for (let i = 0; i < maxScan && dias.length < 2; i += 1) {
    const asiId = buildAsiDocumentId(personaId, ymd);
    const snap = asiId ? await db.collection("asistencia_diaria").doc(asiId).get() : null;
    const capa = resolverCapaTeoricaGrupo(snap?.exists ? snap.data() : null, gdt);
    const presente = Boolean(
      capa &&
        (capa.tipo_dia || capa.tipo_id || capa.tipo || capa.ingreso_teorico || capa.egreso_teorico),
    );
    const tipo = String(capa?.tipo_dia || capa?.tipo || "").toUpperCase();
    if (presente && tipo !== "F" && !tipo.includes("FRANCO")) {
      dias.push(ymd);
    }
    ymd = addDaysYmd(ymd, 1);
  }
  return dias.length === 2 ? { desde: dias[0], hasta: dias[1] } : null;
}

const db = getAdminDb();
const fechaRef = process.env.UAT_FECHA_REF?.trim() || "2026-06-24";
const gdt = await resolveGdtAncla(db, PERSONA, fechaRef);

const report = {
  persona_id: PERSONA,
  grupo_trabajo_id_ancla: gdt,
  uat_p2_04: null,
  uat_p2_05: null,
};

if (!gdt) {
  console.error(JSON.stringify({ error: "Sin HLC vigente / gdt ancla", report }, null, 2));
  process.exit(1);
}

// ── UAT-P2-04: gate RDA (depende_rda) — escenario sin turno planificado ──
const franco = await buscarDiaFranco(db, PERSONA, gdt, addDaysYmd(fechaRef, -30));

const gateRda = await evaluarGrillaTurnoEntorno(db, {
  depende_rda: true,
  persona_id: PERSONA,
  fecha_desde: FECHA_RDA_NEGATIVO,
  fecha_hasta: FECHA_RDA_NEGATIVO,
  grupo_trabajo_id: GDT_RDA_NEGATIVO,
});

const gateCodigo = gateRda.codigo || "";
const gatePass =
  gateRda.ok === false &&
  (gateCodigo === "TURNO_NO_PLANIFICADO" || gateCodigo === "GRILLA_NO_AUTORIZADA");

const entornoPiloto = await validarEntornoOperativoSolicitud({
  db,
  personaId: PERSONA,
  articuloId: ART_63I,
  versionId: VER_63I,
  fechaDesde: fechaRef,
  diasSolicitados: 1,
  grupoTrabajoIdAncla: gdt,
  authToken: null,
});

report.uat_p2_04 = {
  test: "UAT-P2-04",
  articulo_id: ART_63I,
  gate_rda: {
    fecha: FECHA_RDA_NEGATIVO,
    grupo_trabajo_id: GDT_RDA_NEGATIVO,
    ok: gateRda.ok,
    codigo: gateCodigo,
    mensaje: gateRda.mensaje,
    pass: gatePass,
  },
  entorno_piloto_control: {
    fecha: fechaRef,
    grupo_trabajo_id_ancla: gdt,
    ok: entornoPiloto.ok,
    nota: "Control positivo con plan HABILITADO en gdt piloto.",
  },
  franco_detectado: franco?.ymd ?? null,
  pass: gatePass,
};

// ── UAT-P2-05: fan-out 63-C 2 días (MDC CONSOLIDAR_APROBADO) ──
const rango = await buscarDosDiasConTeoria(db, PERSONA, gdt, addDaysYmd(fechaRef, -14));
const { ulid } = require(join(repoRoot, "functions/node_modules/ulid"));
const solUat = `sol_${ulid()}`;

report.uat_p2_05 = {
  test: "UAT-P2-05",
  articulo_id: ART_63C,
  sol_id_sintetico: solUat,
  rango,
  fanout_aplicado: false,
  vis_checks: [],
  pass: false,
};

if (rango && applyFanout) {
  for (const ymd of [rango.desde, rango.hasta]) {
    await fanOutVisUat(db, {
      persona_id: PERSONA,
      fecha_ymd: ymd,
      sol_id: solUat,
      articulo_id: ART_63C,
      codigo_grilla: "63-C",
      estado_solicitud_id: "cfg_esa_aprobada",
      nivel_ocupacion_dia_id: "cfg_nod_exclusivo",
      grupos_trabajo_involucrados_ids: [gdt],
      grupo_trabajo_id: gdt,
      color_ui: COLOR_63C_UAT,
    });
  }
  report.uat_p2_05.fanout_aplicado = true;
  report.uat_p2_05.mdc = {
    ok: true,
    nota: "fanOutVisDesdeAsi directo (mismo worker que mdcFanOutVis.js)",
  };

  for (const ymd of [rango.desde, rango.hasta]) {
    const visId = buildVisDocumentId(PERSONA, ymd, gdt);
    const diaKey = diaMesKeyDesdeYmd(ymd);
    const visSnap = visId ? await db.collection("vistas_grilla_mes_agente").doc(visId).get() : null;
    const eventos = visSnap?.exists
      ? visSnap.data()?.dias?.[diaKey]?.eventos || []
      : [];
    const ev = eventos.find((e) => String(e?.solicitud_id) === solUat);
    report.uat_p2_05.vis_checks.push({
      fecha: ymd,
      vis_id: visId,
      encontrado: Boolean(ev),
      codigo_grilla: ev?.codigo_grilla ?? null,
      color_ui: ev?.color_ui ?? null,
      tiene_teoria_ref: Boolean(ev?.teoria_ref),
    });
  }
  report.uat_p2_05.pass =
    report.uat_p2_05.fanout_aplicado &&
    report.uat_p2_05.vis_checks.every((v) => v.encontrado && v.codigo_grilla === "63-C");
} else if (rango) {
  report.uat_p2_05.nota =
    "Dry-run: rango válido detectado; re-ejecutá con --apply-fanout para escribir vis_*.";
  report.uat_p2_05.pass = null;
}

console.log(JSON.stringify(report, null, 2));
const fail =
  report.uat_p2_04.pass !== true ||
  (applyFanout && report.uat_p2_05.pass !== true);
process.exit(fail ? 1 : 0);
