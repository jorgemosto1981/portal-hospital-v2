/**
 * Smoke integración T-03 — materializarTurnoTeoricoDia contra Firestore Dev.
 *
 * 1) (--setup --apply) Asegura turno base (IDs cfg_reg_turno_*) en plan + override cobertura_parcial.
 * 2) Ejecuta materializarTurnoTeoricoDia para origen (XX) y cobertura (YY).
 * 3) Valida asi_* (segmentos[]) y vis_* (resumen operativo del día).
 *
 * Uso:
 *   node scripts/smoke-materializar-turno-dia-dev.mjs --dry-run
 *   node scripts/smoke-materializar-turno-dia-dev.mjs --setup --apply
 *   node scripts/smoke-materializar-turno-dia-dev.mjs --setup --apply --force-mutate-regimen
 *   node scripts/smoke-materializar-turno-dia-dev.mjs --apply --dni-origen=28914247 --dni-cobertura=12345678
 *   node scripts/smoke-materializar-turno-dia-dev.mjs --apply --fecha=2026-06-10 --segmento=cfg_reg_turno_01_manana
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { capaTeoricaSegmentadaSchema } from "../web/src/schemas/capaTeoricaSegmentos.schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const TAG = "[smoke-mat-dia-dev]";
const COL_PERSONAS = "personas";
const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const COL_PLANES = "planes_turno_servicio";
const COL_ASISTENCIA = "asistencia_diaria";
const COL_VIS = "vistas_grilla_mes_agente";

const TURNOS_DISPONIBLES_SMOKE = [
  { turno_id: "cfg_reg_turno_01_manana", codigo_interno: "M", etiqueta: "Manana", ingreso: "08:00", egreso: "12:00", horas_efectivas: 4, es_nocturno: false },
  { turno_id: "cfg_reg_turno_02_tarde", codigo_interno: "T", etiqueta: "Tarde", ingreso: "14:00", egreso: "18:00", horas_efectivas: 4, es_nocturno: false },
  { turno_id: "cfg_reg_turno_03_noche", codigo_interno: "N", etiqueta: "Noche", ingreso: "22:00", egreso: "06:00", horas_efectivas: 8, es_nocturno: true },
];
const SEGMENTO_SMOKE_DEFAULT = TURNOS_DISPONIBLES_SMOKE[0].turno_id;
const TURNO_BASE_SMOKE_DEFAULT = TURNOS_DISPONIBLES_SMOKE.map((t) => t.turno_id).join("+");

const {
  buildAsiDocumentId,
  buildVisDocumentId,
  diaMesKeyDesdeYmd,
} = require(join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"));
const {
  CFG_TOV_COBERTURA_PARCIAL,
  CFG_TCC_CAMBIO_INTERNO,
} = require(join(repoRoot, "functions/modules/shared/cfgAsistenciaTurnosIds.js"));
const {
  resolverCapaTeoricaGrupo,
} = require(join(repoRoot, "functions/modules/shared/capaTeoricaPorGrupoCore.js"));
const {
  planHabilitadoDesdeQuerySnapshot,
} = require(join(repoRoot, "functions/modules/asistencia/planGrupoAgentesNuevos.js"));

function loadGacPath() {
  const envFile = join(repoRoot, ".env.v2.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("GOOGLE_APPLICATION_CREDENTIALS=")) {
        return t.split("=")[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      }
    }
  }
  return process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

function parseArgs(argv) {
  const out = {
    apply: false,
    setup: false,
    dryRun: false,
    dniOrigen: "28914247",
    dniCobertura: "",
    personaOrigen: "",
    personaCobertura: "",
    fecha: "",
    segmento: SEGMENTO_SMOKE_DEFAULT,
    turnoBase: TURNO_BASE_SMOKE_DEFAULT,
    forceMutateRegimen: false,
  };
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a === "--setup") out.setup = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force-mutate-regimen") out.forceMutateRegimen = true;
    else if (a.startsWith("--dni-origen=")) out.dniOrigen = a.slice("--dni-origen=".length);
    else if (a.startsWith("--dni-cobertura=")) out.dniCobertura = a.slice("--dni-cobertura=".length);
    else if (a.startsWith("--persona-origen=")) out.personaOrigen = a.slice("--persona-origen=".length);
    else if (a.startsWith("--persona-cobertura=")) out.personaCobertura = a.slice("--persona-cobertura=".length);
    else if (a.startsWith("--fecha=")) out.fecha = a.slice("--fecha=".length);
    else if (a.startsWith("--segmento=")) out.segmento = a.slice("--segmento=".length);
    else if (a.startsWith("--turno-base=")) out.turnoBase = a.slice("--turno-base=".length);
  }
  return out;
}

function fechaDefault() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function resolverPersonaId(db, dni, personaIdArg) {
  if (personaIdArg) return personaIdArg.trim();
  const dniNorm = String(dni).replace(/\D/g, "");
  let snap = await db.collection(COL_PERSONAS).where("dni", "==", dniNorm).limit(1).get();
  if (snap.empty) snap = await db.collection(COL_PERSONAS).where("dni", "==", Number(dniNorm)).limit(1).get();
  if (snap.empty) throw new Error(`No se encontró persona con DNI ${dniNorm}`);
  return snap.docs[0].id;
}

async function resolverContextoOrigen(db, personaOrigen, fechaYmd) {
  const [anio, mes] = fechaYmd.split("-").map(Number);
  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const hlgSnap = await db.collection(COL_HLG)
    .where("persona_id", "==", personaOrigen)
    .where("activo", "==", true)
    .get();
  const hlgs = hlgSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((h) => {
      const fi = h.fecha_inicio || "";
      const ff = h.fecha_fin || "";
      if (fi && fi > fechaYmd) return false;
      if (ff && ff < fechaYmd) return false;
      return Boolean(h.regimen_horario_id && h.grupo_de_trabajo_id);
    });
  if (!hlgs.length) throw new Error(`Sin HLG vigente para ${personaOrigen} en ${fechaYmd}`);

  // Preferir grupo con más agentes (Sala Internación u operativo real).
  hlgs.sort((a, b) => String(b.grupo_de_trabajo_id).localeCompare(String(a.grupo_de_trabajo_id)));
  const hlg = hlgs[0];
  const regimenSnap = await db.collection(COL_REGIMEN).doc(hlg.regimen_horario_id).get();
  if (!regimenSnap.exists) throw new Error(`Régimen ${hlg.regimen_horario_id} no encontrado`);
  const regimen = regimenSnap.data();

  let planId = null;
  let plan = null;
  const planHab = await db.collection(COL_PLANES)
    .where("grupo_id", "==", hlg.grupo_de_trabajo_id)
    .where("periodo", "==", periodoId)
    .limit(20)
    .get();
  const canonico = planHabilitadoDesdeQuerySnapshot(planHab);
  if (canonico) {
    planId = canonico.planId;
    plan = canonico.plan;
  }

  return {
    hlg,
    regimen,
    regimenId: hlg.regimen_horario_id,
    grupoId: hlg.grupo_de_trabajo_id,
    planId,
    plan,
    periodoId,
    tipoPatron: regimen.tipo_patron,
  };
}

async function ensureSmokeFixture(db, ctx, personaOrigen, fechaYmd, turnoBase, segmentoId) {
  const { regimenId, grupoId, periodoId, hlg } = ctx;
  const forceMutateRegimen = ctx.forceMutateRegimen === true;
  const turnosDisponibles = Array.isArray(ctx?.regimen?.turnos_disponibles) ? ctx.regimen.turnos_disponibles : [];
  const primerTurnoId = String(turnosDisponibles[0]?.turno_id || "").trim();
  const turnoBaseAplicado = forceMutateRegimen ? turnoBase : primerTurnoId;
  const segmentoAplicado = forceMutateRegimen ? segmentoId : primerTurnoId;

  if (ctx.tipoPatron !== "planificado" && !forceMutateRegimen) {
    throw new Error(
      [
        `Régimen ${regimenId} es '${ctx.tipoPatron || "desconocido"}'.`,
        "Por seguridad, --setup no muta cfg_regimen_horario reales.",
        "Si querés mutarlo explícitamente para un entorno de pruebas descartable, reintentá con --force-mutate-regimen.",
      ].join(" "),
    );
  }

  if (forceMutateRegimen) {
    await db.collection(COL_REGIMEN).doc(regimenId).set({
      tipo_patron: "planificado",
      turnos_disponibles: TURNOS_DISPONIBLES_SMOKE,
      actualizado_en: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`${TAG} [setup] Régimen ${regimenId} mutado explícitamente a planificado (flag --force-mutate-regimen)`);
  } else {
    if (!primerTurnoId) {
      throw new Error(
        `Régimen ${regimenId} no tiene turnos_disponibles; no se puede preparar smoke sin mutarlo.`,
      );
    }
    console.log(`${TAG} [setup] Régimen ${regimenId} no se modifica (modo seguro)`);
  }

  let planId = ctx.planId;
  let plan = ctx.plan;
  if (!planId) {
    const cualquier = await db.collection(COL_PLANES)
      .where("grupo_id", "==", grupoId)
      .where("periodo", "==", periodoId)
      .limit(1)
      .get();
    if (!cualquier.empty) {
      planId = cualquier.docs[0].id;
      plan = cualquier.docs[0].data();
    }
  }

  const agentes = Array.isArray(plan?.agentes) ? [...plan.agentes] : [];
  let ag = agentes.find((a) => a.persona_id === personaOrigen);
  if (!ag) {
    ag = { persona_id: personaOrigen, dias: {} };
    agentes.push(ag);
  }
  ag.dias = ag.dias || {};
  ag.dias[fechaYmd] = { tipo_dia: "laborable", turno_id: turnoBaseAplicado };

  if (planId) {
    await db.collection(COL_PLANES).doc(planId).set({
      grupo_id: grupoId,
      periodo: periodoId,
      estado: "HABILITADO",
      agentes,
      regimen_horario_id: regimenId,
      actualizado_en: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`${TAG} [setup] Plan ${planId} HABILITADO con ${turnoBaseAplicado} en ${fechaYmd}`);
  } else {
    const ref = db.collection(COL_PLANES).doc();
    planId = ref.id;
    await ref.set({
      grupo_id: grupoId,
      periodo: periodoId,
      estado: "HABILITADO",
      agentes,
      regimen_horario_id: regimenId,
      creado_en: FieldValue.serverTimestamp(),
      actualizado_en: FieldValue.serverTimestamp(),
      creado_por_persona_id: personaOrigen,
      nota_smoke: "T-03 integración Dev",
    });
    console.log(`${TAG} [setup] Plan nuevo ${planId} HABILITADO`);
  }

  return {
    ...ctx,
    hlg,
    planId,
    plan: { ...plan, agentes, estado: "HABILITADO" },
    tipoPatron: "planificado",
    smokeSegmento: segmentoAplicado,
    smokeTurnoBase: turnoBaseAplicado,
  };
}

async function resolverPersonaCobertura(db, grupoId, personaOrigen, dniCobertura, personaCoberturaArg) {
  if (personaCoberturaArg) return personaCoberturaArg.trim();
  if (dniCobertura) return resolverPersonaId(db, dniCobertura, "");

  const snap = await db.collection(COL_HLG)
    .where("grupo_de_trabajo_id", "==", grupoId)
    .where("activo", "==", true)
    .limit(20)
    .get();
  const candidato = snap.docs.find((d) => d.data().persona_id !== personaOrigen);
  if (!candidato) throw new Error(`No hay otro agente activo en grupo ${grupoId} para cobertura`);
  return candidato.data().persona_id;
}

async function setupDatos(db, ctx, args, personaOrigen, personaCobertura, fechaYmd) {
  const asiDocId = buildAsiDocumentId(personaOrigen, fechaYmd);
  const grupoId = String(ctx?.grupoId || "").trim();
  const override = {
    tipo: "cobertura_parcial",
    tipo_override_id: CFG_TOV_COBERTURA_PARCIAL,
    tipo_compensacion_id: CFG_TCC_CAMBIO_INTERNO,
    grupo_de_trabajo_id: grupoId,
    persona_origen_id: personaOrigen,
    persona_cobertura_id: personaCobertura,
    segmentos_cubiertos: [args.segmento],
    motivo: "Smoke integración T-03 Dev",
    es_override_manual: true,
    creado_en: new Date().toISOString(),
    invalidado_por_replanificacion: false,
  };

  await db.collection(COL_ASISTENCIA).doc(asiDocId).set({
    persona_id: personaOrigen,
    fecha: fechaYmd,
    overrides_turno: [override],
    actualizado_en: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`${TAG} [setup] ${asiDocId} override cobertura_parcial segmento ${args.segmento}`);
}

function pickCapaParaZod(capa) {
  return {
    fecha_base: capa.fecha_base,
    segmentos: capa.segmentos,
    ingreso_teorico_final: capa.ingreso_teorico_final,
    egreso_teorico_final: capa.egreso_teorico_final,
    horas_teoricas_totales: capa.horas_teoricas_totales,
    turno_compuesto_id: capa.turno_compuesto_id ?? null,
    tiene_huecos: capa.tiene_huecos,
    clasificacion_dia_calendario_id: capa.clasificacion_dia_calendario_id,
    calendario_evento_ref: capa.calendario_evento_ref ?? null,
    multiplicador_institucional: capa.multiplicador_institucional ?? null,
    tipo_dia: capa.tipo_dia,
    es_feriado: capa.es_feriado,
    version_capa_teorica: capa.version_capa_teorica,
    expectativas_fichada_extra: capa.expectativas_fichada_extra,
    fichadas_esperadas: capa.fichadas_esperadas,
    turno_id: capa.turno_id,
    ingreso: capa.ingreso,
    egreso: capa.egreso,
    horas_efectivas: capa.horas_efectivas,
  };
}

function validarCapaPersona({
  capa,
  personaId,
  rol,
  segmento,
  personaOrigen,
  personaCobertura,
  requiereSegmentosAdicionales = false,
}) {
  const parsed = capaTeoricaSegmentadaSchema.parse(pickCapaParaZod(capa));
  const seg = parsed.segmentos.find((s) => s.segmento_id === segmento);
  if (!seg) {
    throw new Error(`[${rol}] Falta segmento ${segmento} en segmentos[]`);
  }
  if (rol === "origen") {
    if (seg.persona_titular_id !== personaOrigen) {
      throw new Error(`[origen] titular esperado ${personaOrigen}, got ${seg.persona_titular_id}`);
    }
    if (seg.persona_ejecutante_id !== personaCobertura) {
      throw new Error(`[origen] ejecutante esperado ${personaCobertura}, got ${seg.persona_ejecutante_id}`);
    }
    if (seg.origen_segmento !== "override_cobertura") {
      throw new Error(`[origen] origen_segmento esperado override_cobertura`);
    }
    const otros = parsed.segmentos.filter((s) => s.segmento_id !== segmento);
    if (requiereSegmentosAdicionales && otros.length < 1) {
      throw new Error(`[origen] Se esperaban más segmentos además de ${segmento} (ej. T+N)`);
    }
  }
  if (rol === "cobertura") {
    if (seg.persona_titular_id !== personaOrigen) {
      throw new Error(`[cobertura] titular esperado ${personaOrigen}, got ${seg.persona_titular_id}`);
    }
    if (seg.persona_ejecutante_id !== personaCobertura) {
      throw new Error(`[cobertura] ejecutante esperado ${personaCobertura}, got ${seg.persona_ejecutante_id}`);
    }
    if (seg.origen_segmento !== "override_cobertura") {
      throw new Error(`[cobertura] origen_segmento esperado override_cobertura`);
    }
  }
  if (!parsed.ingreso_teorico_final || !parsed.egreso_teorico_final) {
    throw new Error(`[${rol}] Resumen derivado incompleto`);
  }
  return parsed;
}

function validarVis(visData, fechaYmd, capa) {
  const diaKey = diaMesKeyDesdeYmd(fechaYmd);
  const dia = visData?.dias?.[diaKey];
  if (!dia) throw new Error(`vis_* sin dias.${diaKey}`);
  if (dia.es_franco === true) throw new Error("vis_* marca franco pero hay segmentos laborales");
  if (!dia.rda_turno_id) throw new Error("vis_* sin rda_turno_id");
  if (!dia.rda_ingreso || !dia.rda_egreso) {
    throw new Error("vis_* sin rda_ingreso/rda_egreso");
  }
  if (capa.turno_id && dia.rda_turno_id !== capa.turno_id && dia.rda_turno_id !== capa.ingreso) {
    console.warn(`${TAG} vis rda_turno_id=${dia.rda_turno_id} capa.turno_id=${capa.turno_id}`);
  }
  if (typeof capa.fichadas_esperadas === "number") {
    if (dia.fichadas_esperadas !== capa.fichadas_esperadas) {
      throw new Error(
        `vis_* fichadas_esperadas=${dia.fichadas_esperadas} distinto de capa=${capa.fichadas_esperadas}`,
      );
    }
  }
}

async function leerEstado(db, personaId, fechaYmd, gdt) {
  const asiDocId = buildAsiDocumentId(personaId, fechaYmd);
  const visDocId = buildVisDocumentId(personaId, fechaYmd, gdt);
  const asiSnap = await db.collection(COL_ASISTENCIA).doc(asiDocId).get();
  const visSnap = await db.collection(COL_VIS).doc(visDocId).get();
  const asiRaw = asiSnap.exists ? asiSnap.data() : null;
  const capaGrupo = resolverCapaTeoricaGrupo(asiRaw, gdt);
  return {
    asiDocId,
    visDocId,
    asi: asiRaw,
    capa: capaGrupo || asiRaw?.capa_teorica || null,
    vis: visSnap.exists ? visSnap.data() : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fechaYmd = args.fecha || fechaDefault();
  const gac = loadGacPath();
  if (!gac || !existsSync(gac)) {
    console.error(`${TAG} Falta GOOGLE_APPLICATION_CREDENTIALS (.env.v2.local)`);
    process.exit(1);
  }

  const sa = JSON.parse(readFileSync(gac, "utf8"));
  if (!getApps().length) {
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  const db = getFirestore();

  const { materializarTurnoTeoricoDia } = require(join(
    repoRoot,
    "functions/modules/asistencia/rdaTurnoTeoricoWorker.js",
  ));

  console.log(`${TAG} proyecto=${sa.project_id} fecha=${fechaYmd}`);
  console.log(`${TAG} modo=${args.apply ? "APPLY" : "READ-ONLY"} setup=${args.setup}`);

  const personaOrigen = await resolverPersonaId(db, args.dniOrigen, args.personaOrigen);
  let ctx = await resolverContextoOrigen(db, personaOrigen, fechaYmd);
  const personaCobertura = await resolverPersonaCobertura(
    db,
    ctx.grupoId,
    personaOrigen,
    args.dniCobertura,
    args.personaCobertura,
  );

  console.log(`${TAG} XX (origen): ${personaOrigen}`);
  console.log(`${TAG} YY (cobertura): ${personaCobertura}`);
  console.log(`${TAG} grupo=${ctx.grupoId} regimen=${ctx.regimenId} plan=${ctx.planId}`);

  if (args.setup) {
    if (!args.apply) {
      console.error(`${TAG} --setup requiere --apply`);
      process.exit(1);
    }
    ctx = await ensureSmokeFixture(
      db,
      { ...ctx, forceMutateRegimen: args.forceMutateRegimen },
      personaOrigen,
      fechaYmd,
      args.turnoBase,
      args.segmento,
    );
    const setupArgs = { ...args, segmento: ctx.smokeSegmento || args.segmento };
    await setupDatos(db, ctx, setupArgs, personaOrigen, personaCobertura, fechaYmd);
  } else if (ctx.tipoPatron !== "planificado" || !ctx.planId) {
    throw new Error(
      "Sin fixture planificado listo. Ejecutá con --setup --apply para preparar Dev.",
    );
  }
  const segmentoValidacion = ctx.smokeSegmento || args.segmento;
  const turnoBaseValidacion = ctx.smokeTurnoBase || args.turnoBase;
  const requiereSegmentosAdicionales = String(turnoBaseValidacion || "").includes("+");

  if (args.apply && !args.dryRun) {
    const rX = await materializarTurnoTeoricoDia({
      personaId: personaOrigen,
      grupoId: ctx.grupoId,
      fechaYmd,
    });
    console.log(`${TAG} materializar XX:`, rX);
    if (!rX.ok || rX.diasProcesados < 1) {
      throw new Error(`Materialización XX falló: ${rX.error || "sin días"}`);
    }

    const rY = await materializarTurnoTeoricoDia({
      personaId: personaCobertura,
      grupoId: ctx.grupoId,
      fechaYmd,
    });
    console.log(`${TAG} materializar YY:`, rY);
    if (!rY.ok || rY.diasProcesados < 1) {
      throw new Error(`Materialización YY falló: ${rY.error || "sin días"}`);
    }
  } else if (!args.setup) {
    console.warn(`${TAG} Sin --apply: solo validación de estado actual`);
  }

  const stX = await leerEstado(db, personaOrigen, fechaYmd, ctx.grupoId);
  const stY = await leerEstado(db, personaCobertura, fechaYmd, ctx.grupoId);

  if (!stX.capa) throw new Error(`${stX.asiDocId} sin capa teórica para ${ctx.grupoId}`);
  const capaX = validarCapaPersona({
    capa: stX.capa,
    personaId: personaOrigen,
    rol: "origen",
    segmento: segmentoValidacion,
    personaOrigen,
    personaCobertura,
    requiereSegmentosAdicionales,
  });
  if (stX.vis) validarVis(stX.vis, fechaYmd, capaX);

  if (!stY.capa) {
    throw new Error(`${stY.asiDocId} sin capa teórica para ${ctx.grupoId} (cobertura debe reflejar segmento ${args.segmento})`);
  }
  const capaY = validarCapaPersona({
    capa: stY.capa,
    personaId: personaCobertura,
    rol: "cobertura",
    segmento: segmentoValidacion,
    personaOrigen,
    personaCobertura,
  });
  if (stY.vis) validarVis(stY.vis, fechaYmd, capaY);

  console.log(`${TAG} ✅ INTEGRACIÓN OK`);
  console.log(JSON.stringify({
    fecha: fechaYmd,
    segmento_cubierto: segmentoValidacion,
    origen: {
      asi: stX.asiDocId,
      segmentos: capaX.segmentos.length,
      turno_compuesto_id: capaX.turno_compuesto_id,
      tiene_huecos: capaX.tiene_huecos,
      ingreso_teorico_final: capaX.ingreso_teorico_final,
      egreso_teorico_final: capaX.egreso_teorico_final,
    },
    cobertura: {
      asi: stY.asiDocId,
      segmentos: capaY.segmentos.length,
      segmento_M: capaY.segmentos.find((s) => s.segmento_id === segmentoValidacion),
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(`${TAG} ❌ FAIL`, err.message || err);
  process.exit(1);
});
