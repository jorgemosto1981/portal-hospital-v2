"use strict";

const { COL_VISTAS_GRILLA_MES } = require("./mdcComandosConstants");
const { buildVisDocumentId } = require("./mdcRdaDocumentIds");
const { buildPersonaLabel } = require("./eventosV2");

const COL_HLG = "historial_laboral_grupos";
const COL_PERSONAS = "personas";
const COL_PLANES = "planes_turno_servicio";
const { planHabilitadoDesdeQuerySnapshot } = require("../asistencia/planGrupoAgentesNuevos");
const { hlgCuentaParaSolapeOperativo } = require("../laboral/hlgValidacionesCore");
const { derivarCargaSemanalDesdeRegimen } = require("../catalogosShared");
const { fusionarDiasDesdeClavesPlanas } = require("./visCeldaFusionLectura");
const {
  hlgSegmentosMes,
  filtrarDiasPorTramo,
  buildPersonaLabelConCarga,
  limitarTramosPorPersonasUnicas,
  rangoMes,
} = require("./hlgSegmentosMes");
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

/**
 * @param {unknown} ts — Firestore Timestamp o similar
 * @returns {string | null} ISO 8601
 */
function firestoreTimestampToIso(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") {
    const d = ts.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof ts === "object" && ts !== null && typeof ts._seconds === "number") {
    return new Date(ts._seconds * 1000).toISOString();
  }
  return null;
}

/**
 * @param {Array<{ vista?: { existe?: boolean; metadata?: { ultima_sync_teorica?: unknown } | null } }>} filasMeta
 */
function construirSyncEstadoDesdeFilas(filasMeta) {
  let ultimaSyncMax = null;
  let filasSinVis = 0;
  let filasDegeneradas = 0;
  for (const row of filasMeta || []) {
    const vista = row.vista;
    if (!vista || vista.existe !== true) {
      filasSinVis += 1;
      continue;
    }
    if (visRequiereMaterializacion(vista)) {
      filasDegeneradas += 1;
    }
    const iso = firestoreTimestampToIso(vista.metadata?.ultima_sync_teorica);
    if (iso && (!ultimaSyncMax || iso > ultimaSyncMax)) {
      ultimaSyncMax = iso;
    }
  }
  const pendiente = filasSinVis + filasDegeneradas > 0;
  return {
    ultima_sync_max: ultimaSyncMax,
    filas_sin_vis: filasSinVis,
    filas_degeneradas: filasDegeneradas,
    reconciliacion: pendiente ? "pendiente" : "idle",
  };
}

/**
 * Lectura batch de vis_* por persona (sin materializar).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ personaIds: string[]; grupoTrabajoId: string; anio: number; mes: number }} opts
 * @returns {Promise<Map<string, Awaited<ReturnType<typeof leerVistaGrillaMesAgente>>>>}
 */
async function leerVistasGrillaMesAgentePorPersonas(db, { personaIds, grupoTrabajoId, anio, mes }) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  const mm = String(m).padStart(2, "0");
  const fechaRef = `${y}-${mm}-01`;
  const unicos = [...new Set((personaIds || []).map((p) => String(p || "").trim()).filter((p) => /^per_/i.test(p)))];
  const byPid = new Map();

  const entries = [];
  for (const pid of unicos) {
    try {
      const visId = buildVisDocumentId(pid, fechaRef, gdt);
      entries.push({ pid, visId });
    } catch {
      byPid.set(pid, {
        ok: false,
        codigo: "PARAMS_INVALIDOS",
        mensaje: "No se pudo resolver id de vista.",
      });
    }
  }

  const GET_ALL_CHUNK = 10;
  for (let i = 0; i < entries.length; i += GET_ALL_CHUNK) {
    const chunk = entries.slice(i, i + GET_ALL_CHUNK);
    const refs = chunk.map(({ visId }) => db.collection(COL_VISTAS_GRILLA_MES).doc(visId));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, idx) => {
      const { pid, visId } = chunk[idx];
      if (!snap.exists) {
        byPid.set(pid, {
          ok: true,
          existe: false,
          vis_id: visId,
          persona_id: pid,
          grupo_trabajo_id: gdt,
          anio: y,
          mes: m,
          dias: {},
          metadata: null,
        });
        return;
      }
      const data = snap.data() || {};
      byPid.set(pid, {
        ok: true,
        existe: true,
        vis_id: visId,
        persona_id: String(data.persona_id || pid),
        grupo_trabajo_id: String(data.grupo_de_trabajo_id || gdt),
        anio: data.anio ?? y,
        mes: data.mes ?? m,
        dias: fusionarDiasDesdeClavesPlanas(data),
        metadata: data.metadata || null,
        estado_periodo_liquidacion_id: data.estado_periodo_liquidacion_id || null,
      });
    });
  }

  return byPid;
}

/**
 * Carga HLg del grupo con fechas resueltas desde HLD cuando aplica.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} grupoTrabajoId
 */
async function cargarHlgsOperativosGrupo(db, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
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

  const rows = [];
  for (const doc of hlgSnap.docs) {
    const hlg = doc.data() || {};
    if (!hlgCuentaParaSolapeOperativo(hlg)) continue;
    const pid = String(hlg.persona_id || "").trim();
    if (!/^per_/i.test(pid)) continue;
    const hld = hldMap.get(String(hlg.dato_laboral_id || "").trim());
    rows.push({
      hlg_id: doc.id,
      persona_id: pid,
      grupo_de_trabajo_id: gdt,
      regimen_horario_id: hlg.regimen_horario_id || null,
      fecha_inicio: hlgFechaInicio(hlg, hld),
      fecha_fin: hlgFechaFin(hlg, hld),
      activo: hlg.activo,
      eliminado: hlg.eliminado,
      estado: hlg.estado,
    });
  }
  return rows;
}

/**
 * Tramos HLg operativos que solapan el mes (1 fila por tramo).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string, anio: number, mes: number }} opts
 */
async function hlgTramosGrupoMes(db, { grupoTrabajoId, anio, mes }) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS" };
  }

  const hlgs = await cargarHlgsOperativosGrupo(db, gdt);
  const tramos = hlgSegmentosMes(hlgs, y, m);
  const rango = rangoMes(y, m);
  return { ok: true, tramos, rango, fecha_corte: rango.ultimoDia };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {Map<string, object|null>} cache
 * @param {string[]} regimenIds
 */
async function resolveRegimenesMap(db, cache, regimenIds) {
  const ids = [...new Set((regimenIds || []).filter(Boolean))];
  const pending = ids.filter((id) => !cache.has(id));
  if (pending.length > 0) {
    const col = db.collection("cfg_regimen_horario");
    const GET_ALL_CHUNK = 10;
    for (let i = 0; i < pending.length; i += GET_ALL_CHUNK) {
      const chunk = pending.slice(i, i + GET_ALL_CHUNK);
      const refs = chunk.map((id) => col.doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s) => {
        cache.set(s.id, s.exists ? s.data() || {} : null);
      });
      for (const id of chunk) {
        if (!cache.has(id)) cache.set(id, null);
      }
    }
  }
  return cache;
}

async function obtenerPlanHabilitadoCache(db, grupoId, periodoId) {
  const snap = await db.collection(COL_PLANES)
    .where("grupo_id", "==", grupoId)
    .where("periodo", "==", periodoId)
    .where("estado", "==", "HABILITADO")
    .limit(20)
    .get();
  return planHabilitadoDesdeQuerySnapshot(snap);
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
    dias: fusionarDiasDesdeClavesPlanas(data),
    metadata: data.metadata || null,
    estado_periodo_liquidacion_id: data.estado_periodo_liquidacion_id || null,
  };
}

async function obtenerVistaGrillaMesAgente(db, opts) {
  const { vista, materializado } = await ensureMaterializacionVisMes(db, opts);
  if (vista.ok === false) return vista;
  return { ...vista, materializado_lazy: materializado };
}

/**
 * Personas con HLg vigente al cierre del mes en un grupo (misma regla que listado GSO).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string, anio: number, mes: number }} opts
 * @returns {Promise<{ ok: boolean, fecha_corte?: string, persona_ids?: string[], codigo?: string }>}
 */
async function personasVigentesIdsGrupoMes(db, { grupoTrabajoId, anio, mes }) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS" };
  }

  const ultimoDia = diasEnMes(y, m);
  const mm = String(m).padStart(2, "0");
  const fechaCorte = `${y}-${mm}-${String(ultimoDia).padStart(2, "0")}`;

  const hlgs = await cargarHlgsOperativosGrupo(db, gdt);
  const vigentes = [];
  for (const h of hlgs) {
    if (!vigenteHlgEnCorte(h.fecha_inicio, h.fecha_fin, fechaCorte)) continue;
    vigentes.push(h.persona_id);
  }

  return { ok: true, fecha_corte: fechaCorte, persona_ids: [...new Set(vigentes)] };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string, anio: number, mes: number }} opts
 */
async function contarPersonasVigentesGrupoMes(db, opts) {
  const r = await personasVigentesIdsGrupoMes(db, opts);
  if (!r.ok) return 0;
  return Array.isArray(r.persona_ids) ? r.persona_ids.length : 0;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ grupoTrabajoId: string, anio: number, mes: number, forzarMaterializacionGrupo?: boolean }} opts
 */
async function listarVistaGrillaMesPorGrupo(db, {
  grupoTrabajoId,
  anio,
  mes,
  forzarMaterializacionGrupo = false,
}) {
  const gdt = String(grupoTrabajoId || "").trim();
  const y = Number(anio);
  const m = Number(mes);
  if (!/^gdt_/i.test(gdt) || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ok: false, codigo: "PARAMS_INVALIDOS", mensaje: "grupo, anio o mes inválidos." };
  }

  const tramosRes = await hlgTramosGrupoMes(db, { grupoTrabajoId: gdt, anio: y, mes: m });
  if (!tramosRes.ok) {
    return { ok: false, codigo: tramosRes.codigo || "PARAMS_INVALIDOS", mensaje: "grupo, anio o mes inválidos." };
  }

  const { tramos: tramosLimitados, total_personas_unicas, truncado } = limitarTramosPorPersonasUnicas(
    tramosRes.tramos,
    MAX_PERSONAS_GRUPO,
  );
  const fechaCorte = tramosRes.fecha_corte || "";
  const personaCache = new Map();
  const regimenCache = new Map();
  await resolveRegimenesMap(
    db,
    regimenCache,
    tramosLimitados.map((t) => t.regimen_horario_id),
  );

  const mm = String(m).padStart(2, "0");
  const periodoId = `${y}-${mm}`;
  const forzar = forzarMaterializacionGrupo === true;

  let matGrupo = { ok: true, procesados: 0, fallos: [] };
  if (forzar) {
    const planCache = await obtenerPlanHabilitadoCache(db, gdt, periodoId);
    const { materializarGrupoMes } = require("../asistencia/rdaTurnoTeoricoWorker");
    matGrupo = await materializarGrupoMes({
      grupoId: gdt,
      anio: y,
      mes: m,
      planCache,
    });
  }

  const personaIdsTramos = tramosLimitados.map((t) => t.persona_id);
  const vistasPorPersona = await leerVistasGrillaMesAgentePorPersonas(db, {
    personaIds: personaIdsTramos,
    grupoTrabajoId: gdt,
    anio: y,
    mes: m,
  });

  const filas = [];
  for (const tramo of tramosLimitados) {
    const pid = tramo.persona_id;
    const vista =
      vistasPorPersona.get(pid)
      || (await leerVistaGrillaMesAgente(db, {
        personaId: pid,
        grupoTrabajoId: gdt,
        anio: y,
        mes: m,
      }));
    const baseLabel = await resolvePersonaLabel(db, pid, personaCache);
    const regimenDoc = tramo.regimen_horario_id ? regimenCache.get(tramo.regimen_horario_id) : null;
    const cargaHoras = derivarCargaSemanalDesdeRegimen(regimenDoc);
    const persona_label = buildPersonaLabelConCarga(baseLabel, cargaHoras);
    const diasCompletos = vista.ok !== false && vista.dias ? vista.dias : {};
    const requiereMat = !forzar && visRequiereMaterializacion(vista);
    filas.push({
      fila_id: tramo.fila_id,
      persona_id: pid,
      hlg_id: tramo.hlg_id,
      regimen_horario_id: tramo.regimen_horario_id,
      nivel_jerarquico: tramo.nivel_jerarquico ?? null,
      vigente_desde: tramo.vigente_desde,
      vigente_hasta: tramo.vigente_hasta,
      carga_horaria_semanal: cargaHoras,
      persona_label,
      vis_id: vista.vis_id || null,
      existe: vista.existe === true,
      dias: filtrarDiasPorTramo(diasCompletos, tramo.vigente_desde, tramo.vigente_hasta),
      materializado_lazy: requiereMat,
    });
  }

  filas.sort((a, b) => String(a.persona_label || "").localeCompare(String(b.persona_label || ""), "es"));

  const sync_estado = construirSyncEstadoDesdeFilas(
    [...vistasPorPersona.values()].map((vista) => ({ vista })),
  );

  if (!forzar && sync_estado.reconciliacion === "pendiente") {
    const { alinearGrillaSyncTrasListar } = require("./grillaSyncGrupoMesCore");
    void alinearGrillaSyncTrasListar(db, {
      grupoTrabajoId: gdt,
      anio: y,
      mes: m,
      sync_estado,
    }).catch(() => {});
  }

  if (forzar) {
    const { buildGrillaSyncGrupoMesDocId, ESTADO_IDLE } = require("./grillaSyncGrupoMesCore");
    const { FieldValue } = require("firebase-admin/firestore");
    const { COL_GRILLA_SYNC_GRUPO_MES } = require("./grillaSyncGrupoMesCore");
    try {
      const docId = buildGrillaSyncGrupoMesDocId(gdt, y, m);
      await db.collection(COL_GRILLA_SYNC_GRUPO_MES).doc(docId).set(
        {
          gdt,
          periodo: `${y}-${mm}`,
          anio: y,
          mes: m,
          estado: ESTADO_IDLE,
          ultimo_ok_at: FieldValue.serverTimestamp(),
          metadata: {
            materializacion_grupo: {
              ok: matGrupo.ok === true,
              procesados: matGrupo.procesados ?? 0,
              fallos: Array.isArray(matGrupo.fallos) ? matGrupo.fallos.length : 0,
            },
          },
          error: null,
        },
        { merge: true },
      );
    } catch {
      /* sync doc opcional */
    }
  }

  let grilla_sync = null;
  try {
    const { leerGrillaSyncGrupoMes } = require("./grillaSyncGrupoMesCore");
    grilla_sync = await leerGrillaSyncGrupoMes(db, { grupoTrabajoId: gdt, anio: y, mes: m });
  } catch {
    grilla_sync = null;
  }

  return {
    ok: true,
    grupo_trabajo_id: gdt,
    anio: y,
    mes: m,
    fecha_corte: fechaCorte,
    total_personas: total_personas_unicas,
    total_filas: filas.length,
    truncado,
    sync_estado,
    grilla_sync,
    materializacion_grupo: forzar
      ? {
          ok: matGrupo.ok === true,
          procesados: matGrupo.procesados ?? 0,
          fallos: Array.isArray(matGrupo.fallos) ? matGrupo.fallos.length : 0,
        }
      : {
          omitida: true,
          motivo: "lectura_snapshot",
          ok: true,
          procesados: 0,
          fallos: 0,
        },
    filas,
  };
}

module.exports = {
  leerVistaGrillaMesAgente,
  obtenerVistaGrillaMesAgente,
  listarVistaGrillaMesPorGrupo,
  hlgTramosGrupoMes,
  personasVigentesIdsGrupoMes,
  contarPersonasVigentesGrupoMes,
  ensureMaterializacionVisMes,
  visRequiereMaterializacion,
  visSnapshotDegenerado,
  construirSyncEstadoDesdeFilas,
};
