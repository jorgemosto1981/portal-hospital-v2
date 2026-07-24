"use strict";

/**
 * Core lectura plantel por GDT — RFC_PLANTEL_Y_PASES_GDT_V2.md §3.
 * Sin auth; el callable aplica RRHH / jurisdicción.
 */

const {
  loadHlgRowsPorGrupo,
  filterHlgVigentesEnFecha,
  hlgVigenteEnFecha,
} = require("../shared/solicitudHlgVigencia");
const { hldHlgFechaInicioYmd } = require("../shared/fechaLaboralYmd");
const { COL_PERSONAS, COL_GRUPOS_TRABAJO } = require("../shared/constants");

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeYmd(raw) {
  const s = String(raw || "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 */
async function loadGrupoTrabajoActivo(db, gdtId) {
  const id = String(gdtId || "").trim();
  if (!/^gdt_/i.test(id)) {
    return { ok: false, code: "invalid-argument", message: "gdt_id inválido." };
  }
  const snap = await db.collection(COL_GRUPOS_TRABAJO).doc(id).get();
  if (!snap.exists) {
    return { ok: false, code: "not-found", message: "Grupo de trabajo no encontrado." };
  }
  const data = snap.data() || {};
  if (data.activo === false) {
    return { ok: false, code: "failed-precondition", message: "El grupo de trabajo no está activo." };
  }
  return {
    ok: true,
    gdt: {
      id: snap.id,
      nombre: String(data.nombre || data.nombre_corto || "").trim() || snap.id,
      parent_group_id: data.parent_group_id ? String(data.parent_group_id).trim() : null,
      activo: data.activo !== false,
    },
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string[]} personaIds
 * @returns {Promise<Map<string, { apellido: string, nombre: string, dni: string }>>}
 */
async function loadPersonasMap(db, personaIds) {
  /** @type {Map<string, { apellido: string, nombre: string, dni: string }>} */
  const map = new Map();
  const ids = [...new Set(personaIds.map((x) => String(x || "").trim()).filter((id) => /^per_/i.test(id)))];
  const chunkSize = 40;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection(COL_PERSONAS).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const d = snap.data() || {};
      map.set(snap.id, {
        apellido: String(d.apellido ?? "").trim(),
        nombre: String(d.nombre ?? "").trim(),
        dni: String(d.dni ?? "").trim(),
      });
    }
  }
  return map;
}

/**
 * @param {Record<string, unknown>} hlg
 * @param {{ apellido: string, nombre: string, dni: string } | undefined} persona
 */
function mapFilaPlantel(hlg, persona) {
  const nivelRaw = hlg.nivel_jerarquico;
  const nivel =
    nivelRaw === null || nivelRaw === undefined || nivelRaw === ""
      ? null
      : Number(nivelRaw);
  return {
    persona_id: String(hlg.persona_id || "").trim(),
    hlg_id: String(hlg.id || "").trim(),
    apellido: persona?.apellido || "",
    nombre: persona?.nombre || "",
    dni: persona?.dni || "",
    nivel_jerarquico: Number.isFinite(nivel) ? nivel : null,
    fecha_inicio: hldHlgFechaInicioYmd(hlg) || null,
    regimen_horario_id: hlg.regimen_horario_id ? String(hlg.regimen_horario_id).trim() : null,
    dato_laboral_id: hlg.dato_laboral_id ? String(hlg.dato_laboral_id).trim() : null,
  };
}

/**
 * Orden: menor nivel_jerarquico primero (mayor rango); sin nivel al final; tie-break apellido/nombre.
 * @param {Array<ReturnType<typeof mapFilaPlantel>>} rows
 */
function sortFilasPlantel(rows) {
  return [...rows].sort((a, b) => {
    const na = a.nivel_jerarquico;
    const nb = b.nivel_jerarquico;
    if (na == null && nb == null) {
      /* continue */
    } else if (na == null) return 1;
    else if (nb == null) return -1;
    else if (na !== nb) return na - nb;
    const ap = `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es");
    if (ap !== 0) return ap;
    return String(a.persona_id).localeCompare(String(b.persona_id));
  });
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ gdtId: string, aFechaYmd: string }} args
 */
async function obtenerPlantelPorGdtCore(db, { gdtId, aFechaYmd }) {
  const gdtCheck = await loadGrupoTrabajoActivo(db, gdtId);
  if (!gdtCheck.ok) {
    return {
      ok: false,
      code: gdtCheck.code,
      message: gdtCheck.message,
    };
  }

  const fecha = normalizeYmd(aFechaYmd);
  if (!fecha) {
    return { ok: false, code: "invalid-argument", message: "a_fecha inválida (YYYY-MM-DD)." };
  }

  const hlgs = await loadHlgRowsPorGrupo(db, gdtCheck.gdt.id);
  const vigentes = filterHlgVigentesEnFecha(hlgs, fecha);
  const personaIds = vigentes.map((h) => String(h.persona_id || "").trim()).filter(Boolean);
  const personas = await loadPersonasMap(db, personaIds);

  const filas = sortFilasPlantel(
    vigentes.map((h) => mapFilaPlantel(h, personas.get(String(h.persona_id || "").trim()))),
  );

  return {
    ok: true,
    gdt: gdtCheck.gdt,
    a_fecha: fecha,
    total: filas.length,
    integrantes: filas,
  };
}

module.exports = {
  normalizeYmd,
  loadGrupoTrabajoActivo,
  loadPersonasMap,
  mapFilaPlantel,
  sortFilasPlantel,
  obtenerPlantelPorGdtCore,
  hlgVigenteEnFecha,
};
