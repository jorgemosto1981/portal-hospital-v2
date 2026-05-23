"use strict";

const { hldHlgFechaInicioYmd, hldHlgFechaFinYmd, vigenteEnFechaInclusivaYmd } = require("./fechaLaboralYmd");
const {
  CODIGO_GRUPO_ANCLA_REQUERIDO,
  CODIGO_GRUPO_ANCLA_INVALIDO,
  CODIGO_SIN_GRUPO_VIGENTE,
  mensajeParaCodigo,
} = require("./solicitudElegibilidadLaboral");

const COL_HLG = "historial_laboral_grupos";
const COL_GDT = "grupos_de_trabajo";

/**
 * @param {Record<string, unknown>} hlg
 * @param {string} fechaRefYmd
 */
function hlgVigenteEnFecha(hlg, fechaRefYmd) {
  if (!hlg || hlg.activo === false) return false;
  return vigenteEnFechaInclusivaYmd(
    hldHlgFechaInicioYmd(hlg),
    hldHlgFechaFinYmd(hlg) || null,
    fechaRefYmd,
  );
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 */
async function loadHlgRows(db, personaId) {
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) return [];
  const snap = await db.collection(COL_HLG).where("persona_id", "==", pid).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 */
async function etiquetaGrupoTrabajo(db, gdtId) {
  const id = String(gdtId || "").trim();
  if (!/^gdt_/i.test(id)) return id || "Grupo";
  const snap = await db.collection(COL_GDT).doc(id).get();
  if (!snap.exists) return id;
  const d = snap.data() || {};
  const nombre = String(d.nombre || d.codigo || d.titulo || "").trim();
  return nombre || id;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {string} fechaYmd
 */
async function listarGruposTrabajoVigentesEnFecha(db, personaId, fechaYmd) {
  const fecha = String(fechaYmd || "").slice(0, 10);
  const rows = await loadHlgRows(db, personaId);
  const porGdt = new Map();

  for (const h of rows) {
    if (!hlgVigenteEnFecha(h, fecha)) continue;
    const gdt = String(h.grupo_de_trabajo_id || "").trim();
    if (!/^gdt_/i.test(gdt) || porGdt.has(gdt)) continue;
    porGdt.set(gdt, {
      grupo_de_trabajo_id: gdt,
      hlg_id: String(h.id || "").trim() || null,
      nivel_jerarquico: Number.isFinite(Number(h.nivel_jerarquico))
        ? Number(h.nivel_jerarquico)
        : null,
    });
  }

  const lista = [...porGdt.values()];
  await Promise.all(
    lista.map(async (item) => {
      item.etiqueta_ui = await etiquetaGrupoTrabajo(db, item.grupo_de_trabajo_id);
    }),
  );
  lista.sort((a, b) => String(a.etiqueta_ui).localeCompare(String(b.etiqueta_ui), "es"));
  return lista;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   persona_id: string,
 *   fecha_desde: string,
 *   grupo_trabajo_id_ancla?: string | null,
 * }} input
 */
async function resolverGrupoTrabajoIdAnclaParaSolicitud(db, input) {
  const personaId = String(input.persona_id || "").trim();
  const fecha = String(input.fecha_desde || "").slice(0, 10);
  const explicito = String(input.grupo_trabajo_id_ancla || "").trim();

  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, personaId, fecha);

  if (vigentes.length === 0) {
    return {
      ok: false,
      codigo: CODIGO_SIN_GRUPO_VIGENTE,
      mensaje: mensajeParaCodigo(CODIGO_SIN_GRUPO_VIGENTE),
      grupos_vigentes: [],
      requiere_seleccion: false,
    };
  }

  if (explicito) {
    const match = vigentes.find((g) => g.grupo_de_trabajo_id === explicito);
    if (!match) {
      return {
        ok: false,
        codigo: CODIGO_GRUPO_ANCLA_INVALIDO,
        mensaje: mensajeParaCodigo(CODIGO_GRUPO_ANCLA_INVALIDO),
        grupos_vigentes: vigentes,
        requiere_seleccion: vigentes.length > 1,
      };
    }
    return {
      ok: true,
      grupo_trabajo_id_ancla: explicito,
      grupos_vigentes: vigentes,
      requiere_seleccion: false,
    };
  }

  if (vigentes.length === 1) {
    return {
      ok: true,
      grupo_trabajo_id_ancla: vigentes[0].grupo_de_trabajo_id,
      grupos_vigentes: vigentes,
      requiere_seleccion: false,
    };
  }

  return {
    ok: false,
    codigo: CODIGO_GRUPO_ANCLA_REQUERIDO,
    mensaje: mensajeParaCodigo(CODIGO_GRUPO_ANCLA_REQUERIDO),
    grupos_vigentes: vigentes,
    requiere_seleccion: true,
  };
}

/**
 * Snapshot inmutable de `gdt_*` vigentes (sin duplicados, orden estable).
 * @param {Array<{ grupo_de_trabajo_id?: string }>} gruposVigentes
 * @returns {string[]}
 */
function buildGruposTrabajoInvolucradosIdsFromVigentes(gruposVigentes) {
  const ids = new Set();
  for (const g of gruposVigentes || []) {
    const id = String(g?.grupo_de_trabajo_id || "").trim();
    if (/^gdt_/i.test(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {string} fechaYmd
 */
async function buildGruposTrabajoInvolucradosSnapshot(db, personaId, fechaYmd) {
  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, personaId, fechaYmd);
  return {
    grupos_trabajo_involucrados_ids: buildGruposTrabajoInvolucradosIdsFromVigentes(vigentes),
    grupos_vigentes: vigentes,
  };
}

/**
 * @param {string} grupoTrabajoIdAncla
 * @param {string[]} gruposInvolucradosIds
 */
function assertGrupoAnclaEnGruposInvolucrados(grupoTrabajoIdAncla, gruposInvolucradosIds) {
  const ancla = String(grupoTrabajoIdAncla || "").trim();
  const ids = Array.isArray(gruposInvolucradosIds) ? gruposInvolucradosIds : [];
  if (!ancla) return { ok: false, mensaje: "grupo_trabajo_id_ancla requerido." };
  if (!ids.includes(ancla)) {
    return {
      ok: false,
      mensaje: "grupo_trabajo_id_ancla no está entre los grupos vigentes del titular en fecha_desde.",
    };
  }
  return { ok: true };
}

module.exports = {
  listarGruposTrabajoVigentesEnFecha,
  resolverGrupoTrabajoIdAnclaParaSolicitud,
  buildGruposTrabajoInvolucradosIdsFromVigentes,
  buildGruposTrabajoInvolucradosSnapshot,
  assertGrupoAnclaEnGruposInvolucrados,
  loadHlgRows,
  hlgVigenteEnFecha,
};
