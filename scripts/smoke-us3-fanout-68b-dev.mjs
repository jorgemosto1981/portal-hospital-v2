/**
 * US-3 — smoke fan-out 68-B (horas) sobre celda con turno M, sin solicitud ni saldos.
 *
 * Usa `fanOutVisDesdeAsiGrupo` (mismo camino que MDC) con `sol_id` sintético.
 * Por defecto: dry-run. Requiere `.env.v2.local` + credenciales Admin.
 *
 * Uso:
 *   node scripts/smoke-us3-fanout-68b-dev.mjs --dni=28914247 --gdt=gdt_01KQA6QCA8TDQK9YBTHKYA4R2V --fecha=2026-06-13 --modo=inject
 *   node scripts/smoke-us3-fanout-68b-dev.mjs ... --modo=inject --apply
 *   node scripts/smoke-us3-fanout-68b-dev.mjs ... --modo=revert --apply
 *   node scripts/smoke-us3-fanout-68b-dev.mjs ... --modo=patch-turno-t
 *   node scripts/smoke-us3-fanout-68b-dev.mjs ... --modo=patch-turno-t --apply
 *   node scripts/smoke-us3-fanout-68b-dev.mjs ... --modo=restore-turno --apply
 *
 * --modo:
 *   inject         → proyecta evento 68-B aprobado (captura teoria_ref del turno M)
 *   revert         → quita el evento smoke de vis_*
 *   patch-turno-t  → simula cambio M→T en capa 1 y evalúa desalineación US-3
 *   restore-turno  → re-materializa el día (vuelve teoría del plan)
 */
import "./load-env-v2.mjs";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { buildVisDocumentId, buildAsiDocumentId, diaMesKeyDesdeYmd } = require(
  join(repoRoot, "functions/modules/shared/mdcRdaDocumentIds.js"),
);
const { calcularTieneConflictoDia } = require(
  join(repoRoot, "functions/modules/shared/mdcVisConflictoDia.js"),
);
const {
  extraerTeoriaRefDesdeCeldaVis,
  evaluarDesalineacionTeoriaLicencia,
  celdaTieneDesalineacionTeoria,
} = require(join(repoRoot, "functions/modules/shared/grillaTeoriaDesalineacion.js"));

const COLOR_APROBADO = "#3B82F6";
const RX_GDT = /^gdt_/i;

/** No crea documento en solicitudes_articulo — solo vis_*. */
const SOL_SMOKE_ID = "sol_SMOKE68B_US3_DIA13";
/** Marca override en asi_* para revertir sin tocar otras gestiones. */
const SMOKE_OVERRIDE_MOTIVO = "SMOKE US3 68B turno T";
const ART_68B_ID = "art_01KRYEF39ZM0KB0F0Y4GPBH38F";
const VER_68B_ID = "ver_01KRYEFZRQF0RKHJ5JTK6244G8";
const CODIGO_GRILLA = "68-B";
const ESTADO_APROBADO = "cfg_esa_aprobada";

const TURNO_T_SMOKE = {
  tipo_dia: "laborable",
  es_franco: false,
  rda_turno_id: "T",
  rda_ingreso: "14:00",
  rda_egreso: "22:00",
  fichadas_esperadas: 2,
};

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
    persona: "",
    dni: "",
    gdt: "",
    fecha: "2026-06-13",
    modo: "inject",
    apply: false,
    nod: "",
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--apply") out.apply = true;
    else if (arg.startsWith("--persona=")) out.persona = arg.slice(10).trim();
    else if (arg.startsWith("--dni=")) out.dni = arg.slice(6).trim();
    else if (arg.startsWith("--gdt=")) out.gdt = arg.slice(6).trim();
    else if (arg.startsWith("--fecha=")) out.fecha = arg.slice(8).trim();
    else if (arg.startsWith("--modo=")) out.modo = arg.slice(7).trim().toLowerCase();
    else if (arg.startsWith("--nod=")) out.nod = arg.slice(6).trim();
  }
  return out;
}

async function resolverNivelOcupacion68B(db, nodOverride) {
  if (nodOverride) return nodOverride;
  const snap = await db
    .doc(`cfg_articulos/${ART_68B_ID}/versiones/${VER_68B_ID}`)
    .get();
  const topes = snap.exists ? snap.data()?.bloque_topes_plazos_computo || {} : {};
  return String(topes.nivel_ocupacion_dia_id || "").trim() || "cfg_nod_parcial";
}

/**
 * Réplica local de fanOutVisDesdeAsiGrupo (misma lógica, FieldValue del script).
 * @param {import("firebase-admin/firestore").Firestore} firestore
 */
async function fanOutVisLocal(firestore, opts) {
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

  if (opts.modo === "revertir") {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(visRef);
      const data = snap.exists ? snap.data() || {} : {};
      const dias = { ...(data.dias || {}) };
      const prev = dias[diaKey] || { eventos: [] };
      const eventos = (Array.isArray(prev.eventos) ? prev.eventos : []).filter(
        (e) => String(e?.solicitud_id || "") !== solId,
      );
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
    return;
  }

  const nivelOcupacion = String(opts.nivel_ocupacion_dia_id || "").trim() || null;
  const ancla = String(opts.grupo_trabajo_id_ancla || opts.grupo_de_trabajo_id || "").trim();

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(visRef);
    const data = snap.exists ? snap.data() || {} : {};
    const dias = { ...(data.dias || {}) };
    const prev = dias[diaKey] || { eventos: [] };
    const prevEventos = Array.isArray(prev.eventos) ? prev.eventos : [];
    const existente = prevEventos.find((e) => String(e?.solicitud_id || "") === solId);
    let teoriaRef = existente?.teoria_ref || null;
    if (!teoriaRef) {
      teoriaRef = extraerTeoriaRefDesdeCeldaVis(prev);
    }
    const rest = prevEventos.filter((e) => String(e?.solicitud_id || "") !== solId);
    const evento = {
      solicitud_id: solId,
      articulo_id: String(opts.articulo_id || "").trim(),
      codigo_grilla: String(opts.codigo_grilla || "").trim(),
      color_ui: COLOR_APROBADO,
      nivel_ocupacion_dia_id: nivelOcupacion,
      estado_solicitud_id: String(opts.estado_solicitud_id || "").trim(),
      ...(RX_GDT.test(ancla) ? { grupo_trabajo_id_ancla: ancla } : {}),
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

function buildSmokeOverrideReemplazo(gdt) {
  return {
    tipo: "reemplazo",
    turno_id: "T",
    ingreso: "14:00",
    egreso: "22:00",
    motivo: SMOKE_OVERRIDE_MOTIVO,
    grupo_de_trabajo_id: gdt,
    es_override_manual: true,
    creado_por_uid: "smoke-us3-fanout-68b",
    creado_en: new Date().toISOString(),
    invalidado_por_replanificacion: false,
  };
}

async function aplicarOverrideTurnoTSmoke(firestore, { pid, fecha, gdt }) {
  const asiId = buildAsiDocumentId(pid, fecha);
  const asiRef = firestore.collection("asistencia_diaria").doc(asiId);
  const entry = buildSmokeOverrideReemplazo(gdt);
  const snap = await asiRef.get();
  const prev = snap.exists && Array.isArray(snap.data()?.overrides_turno)
    ? snap.data().overrides_turno
    : [];
  const sinSmoke = prev.filter((o) => String(o?.motivo || "") !== SMOKE_OVERRIDE_MOTIVO);
  const payload = {
    overrides_turno: [...sinSmoke, entry],
    actualizado_en: FieldValue.serverTimestamp(),
  };
  if (snap.exists) {
    await asiRef.update(payload);
  } else {
    await asiRef.set({
      persona_id: pid,
      fecha,
      ...payload,
      creado_en: FieldValue.serverTimestamp(),
    });
  }
  const { materializarTurnoTeoricoDia } = require(
    join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
  );
  return materializarTurnoTeoricoDia({ personaId: pid, grupoId: gdt, fechaYmd: fecha });
}

async function quitarOverrideTurnoTSmoke(firestore, { pid, fecha, gdt }) {
  const asiId = buildAsiDocumentId(pid, fecha);
  const asiRef = firestore.collection("asistencia_diaria").doc(asiId);
  const snap = await asiRef.get();
  if (!snap.exists) return { ok: true, removed: 0 };
  const prev = Array.isArray(snap.data()?.overrides_turno) ? snap.data().overrides_turno : [];
  const next = prev.filter((o) => String(o?.motivo || "") !== SMOKE_OVERRIDE_MOTIVO);
  await asiRef.update({
    overrides_turno: next,
    actualizado_en: FieldValue.serverTimestamp(),
  });
  const { materializarTurnoTeoricoDia } = require(
    join(repoRoot, "functions/modules/asistencia/rdaTurnoTeoricoWorker.js"),
  );
  const mat = await materializarTurnoTeoricoDia({ personaId: pid, grupoId: gdt, fechaYmd: fecha });
  return { ok: true, removed: prev.length - next.length, materializar: mat };
}

function buildFanOutPayload({ pid, fecha, gdt, nivelOcupacion, modoFanOut }) {
  return {
    persona_id: pid,
    fecha_ymd: fecha,
    sol_id: SOL_SMOKE_ID,
    articulo_id: ART_68B_ID,
    codigo_grilla: CODIGO_GRILLA,
    estado_solicitud_id: ESTADO_APROBADO,
    nivel_ocupacion_dia_id: nivelOcupacion,
    modo: modoFanOut,
    grupo_trabajo_id: gdt,
    grupo_trabajo_id_ancla: gdt,
  };
}

function resumirEvento68B(celda) {
  const evs = Array.isArray(celda?.eventos) ? celda.eventos : [];
  const ev = evs.find((e) => String(e?.solicitud_id || "") === SOL_SMOKE_ID);
  if (!ev) return null;
  return {
    solicitud_id: ev.solicitud_id,
    codigo_grilla: ev.codigo_grilla,
    nivel_ocupacion_dia_id: ev.nivel_ocupacion_dia_id,
    estado_solicitud_id: ev.estado_solicitud_id,
    grupo_trabajo_id_ancla: ev.grupo_trabajo_id_ancla || null,
    teoria_ref: ev.teoria_ref || null,
    color_ui: ev.color_ui || null,
  };
}

function resumirPisoTeorico(celda) {
  return {
    tipo_dia: celda?.tipo_dia ?? null,
    es_franco: celda?.es_franco ?? null,
    rda_turno_id: celda?.rda_turno_id || null,
    rda_ingreso: celda?.rda_ingreso || null,
    rda_egreso: celda?.rda_egreso || null,
    fichadas_esperadas: celda?.fichadas_esperadas ?? null,
  };
}

const args = parseArgs(process.argv);
const modosValidos = new Set(["inject", "revert", "patch-turno-t", "restore-turno"]);
const gac = loadGacPath();
if (!gac || !existsSync(gac)) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.v2.local");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(gac, "utf8"))) });
}
const db = getFirestore();

let pid = args.persona;
if (!pid && args.dni) {
  const snap = await db.collection("personas").where("dni", "==", args.dni).limit(1).get();
  if (snap.empty) {
    console.error("Persona no encontrada DNI", args.dni);
    process.exit(1);
  }
  pid = snap.docs[0].id;
}

if (
  !/^per_/i.test(pid)
  || !/^gdt_/i.test(args.gdt)
  || !/^\d{4}-\d{2}-\d{2}$/.test(args.fecha)
  || !modosValidos.has(args.modo)
) {
  console.error(
    "Uso: --persona=per_*|--dni=... --gdt=gdt_* [--fecha=YYYY-MM-DD] --modo=inject|revert|patch-turno-t|restore-turno [--nod=cfg_nod_*] [--apply]",
  );
  process.exit(1);
}

const diaKey = diaMesKeyDesdeYmd(args.fecha);
const visId = buildVisDocumentId(pid, args.fecha, args.gdt);
const visRef = db.collection("vistas_grilla_mes_agente").doc(visId);
const visSnap = await visRef.get();

if (!visSnap.exists) {
  console.error("vis_* no existe:", visId);
  process.exit(1);
}

const celdaAntes = (visSnap.data().dias || {})[diaKey] || {};
const nivelOcupacion = await resolverNivelOcupacion68B(db, args.nod);
const fanOutInject = buildFanOutPayload({
  pid,
  fecha: args.fecha,
  gdt: args.gdt,
  nivelOcupacion,
  modoFanOut: "aprobado",
});
const fanOutRevert = { ...fanOutInject, modo: "revertir" };

const reporte = {
  ok: true,
  dry_run: !args.apply,
  smoke_sol_id: SOL_SMOKE_ID,
  vis_id: visId,
  dia_key: diaKey,
  fecha: args.fecha,
  persona_id: pid,
  grupo_id: args.gdt,
  modo: args.modo,
  fanout_payload: args.modo === "revert" ? fanOutRevert : fanOutInject,
  piso_antes: resumirPisoTeorico(celdaAntes),
  evento_smoke_antes: resumirEvento68B(celdaAntes),
  teoria_ref_esperada_al_inyectar: extraerTeoriaRefDesdeCeldaVis(celdaAntes),
};

if (args.modo === "inject") {
  if (!celdaAntes.rda_turno_id) {
    reporte.ok = false;
    reporte.error = "El día no tiene turno teórico (rda_turno_id). Elegí un día laborable con M/T.";
  }
} else if (args.modo === "patch-turno-t") {
  const celdaSimulada = { ...celdaAntes, ...TURNO_T_SMOKE };
  const ev = resumirEvento68B(celdaAntes);
  const desalEv = ev?.teoria_ref
    ? evaluarDesalineacionTeoriaLicencia(ev.teoria_ref, celdaSimulada)
    : { desalineado: false, nota: "Sin evento smoke — corré inject --apply primero" };
  const desalCelda = celdaTieneDesalineacionTeoria(celdaAntes.eventos, celdaSimulada);
  reporte.piso_simulado_T = resumirPisoTeorico(celdaSimulada);
  reporte.us3_eval_evento = desalEv;
  reporte.us3_eval_celda = desalCelda;
  reporte.patch_desc =
    `asi_*.overrides_turno reemplazo T + materializarTurnoTeoricoDia (persiste tras listar grilla)`;
  reporte.nota =
    "El patch directo en vis_* se revierte al abrir la grilla (materializarGrupoMes).";
}

console.log(JSON.stringify(reporte, null, 2));

if (!args.apply) {
  console.log("\nDry-run. Agregá --apply para escribir en Firestore.");
  process.exit(reporte.ok ? 0 : 1);
}

if (args.modo === "inject") {
  await fanOutVisLocal(db, fanOutInject);
} else if (args.modo === "revert") {
  await fanOutVisLocal(db, fanOutRevert);
} else if (args.modo === "patch-turno-t") {
  const mat = await aplicarOverrideTurnoTSmoke(db, { pid, fecha: args.fecha, gdt: args.gdt });
  console.log("\nOverride + materializar:", mat);
} else if (args.modo === "restore-turno") {
  const r = await quitarOverrideTurnoTSmoke(db, { pid, fecha: args.fecha, gdt: args.gdt });
  console.log("\nRestore override:", r);
}

const visDespues = (await visRef.get()).data()?.dias?.[diaKey] || {};
console.log("\n=== Después ===");
console.log(JSON.stringify({
  piso: resumirPisoTeorico(visDespues),
  evento_smoke: resumirEvento68B(visDespues),
  us3: celdaTieneDesalineacionTeoria(visDespues.eventos, visDespues),
}, null, 2));

if (args.modo === "inject") {
  console.log("\nValidá en grilla RRHH el día", args.fecha, "— chip 68-B sobre turno M.");
  console.log("Paso 2: --modo=patch-turno-t (dry-run) luego --apply para ver ⚠️ US-3.");
  console.log("Revertir evento: --modo=revert --apply | Restaurar turno: --modo=restore-turno --apply");
}
