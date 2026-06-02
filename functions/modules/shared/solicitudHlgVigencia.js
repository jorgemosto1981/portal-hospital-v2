"use strict";

const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd, vigenteEnFechaInclusivaYmd } = require("./fechaLaboralYmd");

const COL_HLG = "historial_laboral_grupos";

/**
 * HLg vigente para operación (solicitud, ancla, involucrados) en fechaRef.
 * Deshabilitación administrativa (`activo: false`) cierra en `fecha_fin` con vigencia inclusiva:
 * el día de corte sigue contando; al día siguiente no.
 *
 * @param {Record<string, unknown>} hlg
 * @param {string} fechaRefYmd
 */
function hlgVigenteEnFecha(hlg, fechaRefYmd) {
  if (!hlg) return false;
  const finYmd = hldHlgFechaFinYmd(hlg);
  const inRange = vigenteEnFechaInclusivaYmd(
    hldHlgFechaInicioYmd(hlg),
    finYmd || null,
    fechaRefYmd,
  );
  if (hlg.activo !== false) return inRange;
  if (!finYmd) return false;
  return inRange;
}

/**
 * HLg vigente para grilla operativa / capa teórica hacia adelante.
 * Con `activo: false`, `fecha_fin` es el primer día **sin** incorporación operativa
 * (corte exclusivo: ref >= fecha_fin → no vigente).
 *
 * @param {Record<string, unknown>} hlg
 * @param {string} fechaRefYmd
 */
function hlgVigenteOperativaEnGrilla(hlg, fechaRefYmd) {
  if (!hlg) return false;
  const ref = String(fechaRefYmd || "").slice(0, 10);
  const desde = hldHlgFechaInicioYmd(hlg);
  const finYmd = hldHlgFechaFinYmd(hlg);
  if (!desde || !ref || desde > ref) return false;
  if (hlg.activo !== false) {
    return vigenteEnFechaInclusivaYmd(desde, finYmd || null, ref);
  }
  if (!finYmd) return false;
  return ref < finYmd;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 */
async function loadHlgRowsPorPersona(db, personaId) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) return [];
  const snap = await db.collection(COL_HLG).where("persona_id", "==", pid).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} grupoTrabajoId
 */
async function loadHlgRowsPorGrupo(db, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
  if (!/^gdt_/i.test(gdt)) return [];
  const snap = await db.collection(COL_HLG).where("grupo_de_trabajo_id", "==", gdt).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} fechaRefYmd
 */
function filterHlgVigentesEnFecha(rows, fechaRefYmd) {
  return rows.filter((h) => hlgVigenteEnFecha(h, fechaRefYmd));
}

/**
 * Nivel jerárquico del titular en un grupo (menor número = mayor rango). null si no hay fila vigente.
 * @param {Array<Record<string, unknown>>} titularHlgVigentes
 * @param {string} grupoTrabajoId
 */
function nivelTitularEnGrupo(titularHlgVigentes, grupoTrabajoId) {
  const gdt = String(grupoTrabajoId || "").trim();
  const niveles = [];
  for (const h of titularHlgVigentes) {
    if (String(h.grupo_de_trabajo_id || "").trim() !== gdt) continue;
    const rawNivel = h.nivel_jerarquico;
    if (rawNivel === null || rawNivel === undefined || rawNivel === "") continue;
    const n = Number(rawNivel);
    if (Number.isFinite(n)) niveles.push(n);
  }
  if (niveles.length === 0) return null;
  return Math.min(...niveles);
}

module.exports = {
  COL_HLG,
  hlgVigenteEnFecha,
  hlgVigenteOperativaEnGrilla,
  loadHlgRowsPorPersona,
  loadHlgRowsPorGrupo,
  filterHlgVigentesEnFecha,
  nivelTitularEnGrupo,
};
