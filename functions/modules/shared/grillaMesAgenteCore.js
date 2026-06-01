"use strict";

const { COL_VISTAS_GRILLA_MES } = require("./mdcComandosConstants");
const { buildVisDocumentId } = require("./mdcRdaDocumentIds");
const { buildPersonaLabel } = require("./eventosV2");

const COL_HLG = "historial_laboral_grupos";
const COL_PERSONAS = "personas";
const COL_PLANES = "planes_turno_servicio";
const MAX_PERSONAS_GRUPO = 60;
/** Mes casi completo con datos pero sin jornada ni francos (snapshot corrupto tipo Portería mayo). */
const MIN_DIAS_EVALUAR_DEGENERADO = 20;

function celdaTieneSenalTurno(c) {
  if (!c || typeof c !== "object") return false;
  return Boolean(
    c.tipo_dia ||
      c.rda_turno_id ||
      c.rda_ingreso ||
      c.rda_egreso ||
      c.es_franco === true,
  );
}

function celdaEsFranco(c) {
  if (!c || typeof c !== "object") return false;
  return c.es_franco === true || c.tipo_dia === "franco";
}

function celdaTieneHorarioTeorico(c) {
  if (!c || typeof c !== "object") return false;
  return Boolean(c.rda_ingreso || c.rda_egreso);
}

/**
 * Snapshot relleno pero sin jornada teórica ni francos (p. ej. 31× no_laborable sin horarios).
 */
function visSnapshotDegenerado(dias) {
  const keys = Object.keys(dias);
  if (keys.length < MIN_DIAS_EVALUAR_DEGENERADO) return false;

  let conHorario = 0;
  let franco = 0;
  let noLaborable = 0;

  for (const k of keys) {
    const c = dias[k];
    if (!c || typeof c !== "object") continue;
    if (celdaTieneHorarioTeorico(c)) conHorario += 1;
    if (celdaEsFranco(c)) franco += 1;
    if (c.tipo_dia === "no_laborable") noLaborable += 1;
  }

  const sinJornadaNiFranco = conHorario === 0 && franco === 0;
  const todasNoLaborable = noLaborable === keys.length;
  return sinJornadaNiFranco || todasNoLaborable;
}

function visRequiereMaterializacion(vista) {
  if (!vista || vista.existe !== true) return true;
  const dias = vista.dias && typeof vista.dias === "object" ? vista.dias : {};
  const keys = Object.keys(dias);
  if (keys.length === 0) return true;
  if (visSnapshotDegenerado(dias)) return true;
  const conTurno = keys.filter((k) => celdaTieneSenalTurno(dias[k]));
  return conTurno.length === 0;
}

async function obtenerPlanHabilitadoCache(db, grupoId, periodoId) {
  const snap = await db.collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodoId)
    .where("estado", "==", "HABILITADO")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { planId: snap.docs[0].id, plan: snap.docs[0].data() };
}

/**
 * Si no hay vis_* con turno teórico, materializa mes persona+gdt y re-lee.
 */
async function ensureMaterializacionVisMes(db, { personaId, grupoTrabajoId, anio, mes }) {
  let vista = await leerVistaGrillaMesAgente(db, { personaId, grupoTrabajoId, anio, mes });
  if (!visRequiereMaterializacion(vista)) {
    return { vista, materializado: false };
  }

  const periodoId = `${anio}-${String(mes).padStart(2, "0")}`;
  const planCache = await obtenerPlanHabilitadoCache(db, grupoTrabajoId, periodoId);
  const { materializarTurnoMesBatch } = require("../asistencia/rdaTurnoTeoricoWorker");
  await materializarTurnoMesBatch({
    personaId,
    grupoId: grupoTrabajoId,
    anio,
    mes,
    planCache,
  });
  vista = await leerVistaGrillaMesAgente(db, { personaId, grupoTrabajoId, anio, mes });
  return { vista, materializado: true };
}

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function vigenteHlgEnCorte(fechaInicio, fechaFin, corteYmd) {
  const c = String(corteYmd || "").slice(0, 10);
  const i = String(fechaInicio || "").slice(0, 10);
  const f = fechaFin ? String(fechaFin).slice(0, 10) : "9999-12-31";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c) || !/^\d{4}-\d{2}-\d{2}$/.test(i)) return false;
  return i <= c && c <= f;
}

function hlgFechaInicio(hlg, hld) {
  return String(hlg?.fecha_inicio || hld?.fecha_inicio || "").slice(0, 10);
}

function hlgFechaFin(hlg, hld) {
  const v = hlg?.fecha_fin ?? hld?.fecha_fin;
  return v ? String(v).slice(0, 10) : null;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {Map<string, string>} cache
 */
async function resolvePersonaLabel(db, personaId, cache) {
  const id = String(personaId || "").trim();
  if (!id) return id;
  if (cache.has(id)) return cache.get(id);
  const snap = await db.collection(COL_PERSONAS).doc(id).get();
  const label = snap.exists ? buildPersonaLabel(snap.data()) : id;
  cache.set(id, label);
  return label;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ personaId: string, grupoTrabajoId: string, anio: number, mes: number }} opts
 */
async function leerVistaGrillaMesAgente(db, { personaId, grupoTrabajoId, anio, mes }) {
  const pid = String(personaId || "").trim();
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^per_/i.test(pid) || !/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "persona_id, grupo_trabajo_id (gdt_*), anio o mes inválidos." };
  }

  const mm = String(m).padStart(2, "0");
  const fechaRef = `${y}-${mm}-01`;
  let visId;
  try {
    visId = buildVisDocumentId(pid, fechaRef, gdt);
  } catch (e) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: e.message || "No se pudo resolver id de vista." };
  }

  const snap = await db.collection(COL_VISTAS_GRILLA_MES).doc(visId).get();
  if (!snap.exists) {
    return {
      ok: true,
      existe: false,
      vis_id: visId,
      persona_id: pid,
      grupo_trabajo_id: gdt,
      anio: y,
      mes: m,
      dias: {},
    };
  }

  const data = snap.data() || {};
  return {
    ok: true,
    existe: true,
    vis_id: visId,
    persona_id: String(data.persona_id || pid),
    grupo_trabajo_id: String(data.grupo_de_trabajo_id || gdt),
    anio: data.anio ?? y,
    mes: data.mes ?? m,
    dias: data.dias && typeof data.dias === "object" ? data.dias : {},
    metadata: data.metadata || null,
  };
}

async function obtenerVistaGrillaMesAgente(db, opts) {
  const { vista, materializado } = await ensureMaterializacionVisMes(db, opts);
  if (vista.ok === false) return vista;
  return { ...vista, materializado_lazy: materializado };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string, anio: number, mes: number }} opts
 */
async function listarVistaGrillaMesPorGrupo(db, { grupoTrabajoId, anio, mes }) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "grupo, anio o mes inválidos." };
  }

  const ultimoDia = diasEnMes(y, m);
  const mm = String(m).padStart(2, "0");
  const fechaCorte = `${y}-${mm}-${String(ultimoDia).padStart(2, "0")}`;

  const hlgSnap = await db.collection(COL_HLG).where("grupo_de_trabajo_id", "==", gdt).get();
  const hldIds = new Set();
  for (const doc of hlgSnap.docs) {
    const hldId = String((doc.data() || {}).dato_laboral_id || "").trim();
    if (hldId) hldIds.add(hldId);
  }

  const hldMap = new Map();
  if (hldIds.size > 0) {
    const ids = [...hldIds].slice(0, 200);
    const col = db.collection("historial_laboral_datos");
    const GET_ALL_CHUNK = 10;
    for (let i = 0; i < ids.length; i += GET_ALL_CHUNK) {
      const chunk = ids.slice(i, i + GET_ALL_CHUNK);
      const refs = chunk.map((id) => col.doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s) => {
        if (s.exists) hldMap.set(s.id, s.data() || {});
      });
    }
  }

  const vigentes = [];
  for (const doc of hlgSnap.docs) {
    const hlg = doc.data() || {};
    if (hlg.activo === false) continue;
    const pid = String(hlg.persona_id || "").trim();
    if (!/^per_/i.test(pid)) continue;
    const hld = hldMap.get(String(hlg.dato_laboral_id || "").trim());
    const ini = hlgFechaInicio(hlg, hld);
    const fin = hlgFechaFin(hlg, hld);
    if (!vigenteHlgEnCorte(ini, fin, fechaCorte)) continue;
    vigentes.push(pid);
  }

  const unique = [...new Set(vigentes)];
  const truncado = unique.length > MAX_PERSONAS_GRUPO;
  const limited = unique.slice(0, MAX_PERSONAS_GRUPO);
  const personaCache = new Map();
  const filas = [];

  const periodoId = `${y}-${mm}`;
  const planCache = await obtenerPlanHabilitadoCache(db, gdt, periodoId);
  const { materializarGrupoMes } = require("../asistencia/rdaTurnoTeoricoWorker");
  const matGrupo = await materializarGrupoMes({
    grupoId: gdt,
    anio: y,
    mes: m,
    planCache,
  });

  for (const pid of limited) {
    const vista = await leerVistaGrillaMesAgente(db, {
      personaId: pid,
      grupoTrabajoId: gdt,
      anio: y,
      mes: m,
    });
    const persona_label = await resolvePersonaLabel(db, pid, personaCache);
    filas.push({
      persona_id: pid,
      persona_label,
      vis_id: vista.vis_id || null,
      existe: vista.existe === true,
      dias: vista.ok !== false && vista.dias ? vista.dias : {},
      materializado_lazy: false,
    });
  }

  filas.sort((a, b) => String(a.persona_label || "").localeCompare(String(b.persona_label || ""), "es"));

  return {
    ok: true,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
    fecha_corte: fechaCorte,
    total_personas: filas.length,
    truncado,
    materializacion_grupo: {
      ok: matGrupo.ok === true,
      procesados: matGrupo.procesados ?? 0,
      fallos: Array.isArray(matGrupo.fallos) ? matGrupo.fallos.length : 0,
    },
    filas,
  };
}

module.exports = {
  obtenerVistaGrillaMesAgente,
  listarVistaGrillaMesPorGrupo,
  ensureMaterializacionVisMes,
  visRequiereMaterializacion,
  visSnapshotDegenerado,
};
