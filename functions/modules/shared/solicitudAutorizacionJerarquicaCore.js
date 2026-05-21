"use strict";

/**
 * Resolución de autorizadores elegibles (RFC §5.2) — Oleada A1.
 * @see docs/v2/RFC_TICKETERA_AUTORIZACION_TOMA_CONOCIMIENTO_V2.md
 */

const {
  CODIGO_ELEG_SIN_HLG,
  CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS,
  CODIGO_ORGANIGRAMA_CICLICO,
  CODIGO_GRUPO_ANCLA_INVALIDO,
  CODIGO_FECHA_REF_INVALIDA,
  CODIGO_TITULAR_INVALIDO,
  mensajeParaCodigoAutorizacion,
} = require("./solicitudAutorizacionCodigos");
const {
  loadHlgRowsPorPersona,
  loadHlgRowsPorGrupo,
  filterHlgVigentesEnFecha,
  nivelTitularEnGrupo,
} = require("./solicitudHlgVigencia");

const COL_GDT = "grupos_de_trabajo";
const MAX_DEPTH_ESCALAMIENTO = 10;
const RX_PER = /^per_/i;
const RX_GDT = /^gdt_/i;
const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 */
async function loadGrupoTrabajo(db, gdtId) {
  const snap = await db.collection(COL_GDT).doc(gdtId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() || {}) };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 * @param {Set<string>} visited
 */
async function escalarGrupoPadre(db, gdtId, visited) {
  const id = String(gdtId || "").trim();
  if (!RX_GDT.test(id)) return { ok: false, codigo: CODIGO_GRUPO_ANCLA_INVALIDO };

  const g = await loadGrupoTrabajo(db, id);
  if (!g) return { ok: false, codigo: CODIGO_GRUPO_ANCLA_INVALIDO };

  const padre = String(g.parent_group_id || "").trim();
  if (!padre) return { ok: true, parent_group_id: null };

  if (visited.has(padre)) {
    return { ok: false, codigo: CODIGO_ORGANIGRAMA_CICLICO };
  }
  return { ok: true, parent_group_id: padre };
}

/**
 * Superiores jerárquicos: `nivel_jerarquico` 01–99 donde **01 = menor** y **99 = mayor**.
 * Candidatos con nivel **estrictamente mayor** que el titular en la burbuja.
 * @param {Array<Record<string, unknown>>} integrantesVigentes
 * @param {string} titularPersonaId
 * @param {number|null} nivelTitular
 */
function autorizadoresCandidatosEnGrupo(integrantesVigentes, titularPersonaId, nivelTitular) {
  const titular = String(titularPersonaId || "").trim();
  if (!Number.isFinite(nivelTitular)) return [];

  const out = [];
  for (const h of integrantesVigentes) {
    const pid = String(h.persona_id || "").trim();
    if (!RX_PER.test(pid) || pid === titular) continue;
    const rawNivel = h.nivel_jerarquico;
    if (rawNivel === null || rawNivel === undefined || rawNivel === "") continue;
    const n = Number(rawNivel);
    if (!Number.isFinite(n)) continue;
    if (n > nivelTitular) out.push({ persona_id: pid, nivel: n });
  }
  return out;
}

/**
 * Autorizador(es) con el **mayor** nivel jerárquico entre superiores (hasta 99).
 * Ej.: titular 20 y niveles 25, 60, 77 → autoriza quien tenga 77 (empate OR si varios en 77).
 * @param {Array<{ persona_id: string, nivel: number }>} candidatos
 */
function reducirAutorizadoresPorMejorRango(candidatos) {
  if (candidatos.length === 0) {
    return { autorizadores_elegibles_ids: [], nivel_autorizacion: null };
  }
  const nivelAuth = Math.max(...candidatos.map((c) => c.nivel));
  const ids = [
    ...new Set(
      candidatos.filter((c) => c.nivel === nivelAuth).map((c) => c.persona_id),
    ),
  ].sort();
  return { autorizadores_elegibles_ids: ids, nivel_autorizacion: nivelAuth };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titularPersonaId: string,
 *   grupoTrabajoId: string,
 *   nivelTitularAncla: number|null,
 *   fechaRefYmd: string,
 * }} input
 */
async function resolverAutorizadoresElegiblesEnGrupo(db, input) {
  const integrantes = await loadHlgRowsPorGrupo(db, input.grupoTrabajoId);
  const vigentes = filterHlgVigentesEnFecha(integrantes, input.fechaRefYmd);
  const candidatos = autorizadoresCandidatosEnGrupo(
    vigentes,
    input.titularPersonaId,
    input.nivelTitularAncla,
  );
  return reducirAutorizadoresPorMejorRango(candidatos);
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titularPersonaId: string,
 *   grupoTrabajoIdAncla: string,
 *   fechaRefYmd: string,
 * }} input
 * @returns {Promise<{
 *   ok: boolean,
 *   codigo?: string,
 *   mensaje?: string,
 *   autorizadores_elegibles_ids: string[],
 *   grupo_autorizacion_id: string|null,
 *   escalamiento_jerarquico_ids: string[],
 *   autorizacion_rrhh_sustituta: boolean,
 * }>}
 */
async function resolverCadenaAutorizacion(db, input) {
  const titularPersonaId = String(input.titularPersonaId || "").trim();
  const grupoTrabajoIdAncla = String(input.grupoTrabajoIdAncla || "").trim();
  const fechaRefYmd = String(input.fechaRefYmd || "").slice(0, 10);

  if (!RX_PER.test(titularPersonaId)) {
    return fail(CODIGO_TITULAR_INVALIDO);
  }
  if (!RX_GDT.test(grupoTrabajoIdAncla)) {
    return fail(CODIGO_GRUPO_ANCLA_INVALIDO);
  }
  if (!RX_YMD.test(fechaRefYmd)) {
    return fail(CODIGO_FECHA_REF_INVALIDA);
  }

  const titularHlg = await loadHlgRowsPorPersona(db, titularPersonaId);
  const titularVigentes = filterHlgVigentesEnFecha(titularHlg, fechaRefYmd);
  const nivelTitularAncla = nivelTitularEnGrupo(titularVigentes, grupoTrabajoIdAncla);

  const tieneHlgEnAncla = titularVigentes.some(
    (h) => String(h.grupo_de_trabajo_id || "").trim() === grupoTrabajoIdAncla,
  );
  if (!tieneHlgEnAncla) {
    return fail(CODIGO_ELEG_SIN_HLG);
  }

  const escalamiento = [];
  const visited = new Set();
  let currentGdt = grupoTrabajoIdAncla;

  for (let depth = 0; depth <= MAX_DEPTH_ESCALAMIENTO; depth += 1) {
    visited.add(currentGdt);

    const { autorizadores_elegibles_ids } = await resolverAutorizadoresElegiblesEnGrupo(db, {
      titularPersonaId,
      grupoTrabajoId: currentGdt,
      nivelTitularAncla,
      fechaRefYmd,
    });

    if (autorizadores_elegibles_ids.length > 0) {
      return {
        ok: true,
        autorizadores_elegibles_ids,
        grupo_autorizacion_id: currentGdt,
        escalamiento_jerarquico_ids: escalamiento,
        autorizacion_rrhh_sustituta: false,
      };
    }

    const esc = await escalarGrupoPadre(db, currentGdt, visited);
    if (!esc.ok) {
      return fail(esc.codigo || CODIGO_ORGANIGRAMA_CICLICO);
    }
    const padre = esc.parent_group_id;
    if (!padre) break;

    escalamiento.push(currentGdt);
    currentGdt = padre;
  }

  return {
    ok: true,
    autorizadores_elegibles_ids: [],
    grupo_autorizacion_id: null,
    escalamiento_jerarquico_ids: escalamiento,
    autorizacion_rrhh_sustituta: true,
  };
}

/**
 * @param {string} codigo
 */
function fail(codigo) {
  return {
    ok: false,
    codigo,
    mensaje: mensajeParaCodigoAutorizacion(codigo),
    autorizadores_elegibles_ids: [],
    grupo_autorizacion_id: null,
    escalamiento_jerarquico_ids: [],
    autorizacion_rrhh_sustituta: false,
  };
}

/**
 * Campos a persistir en `sol_*` (onCreate / refresh).
 * @param {Awaited<ReturnType<typeof resolverCadenaAutorizacion>>} cadena
 */
function buildAutorizacionSnapshotFields(cadena) {
  if (!cadena.ok) return {};
  return {
    autorizadores_elegibles_ids: cadena.autorizadores_elegibles_ids || [],
    grupo_autorizacion_id: cadena.grupo_autorizacion_id || null,
    escalamiento_jerarquico_ids: cadena.escalamiento_jerarquico_ids || [],
    autorizacion_rrhh_sustituta: cadena.autorizacion_rrhh_sustituta === true,
  };
}

/**
 * ¿El revisor puede autorizar/rechazar en bandeja jefe (TO-BE)?
 * @param {{
 *   autorizadores_elegibles_ids?: string[],
 *   autorizacion_rrhh_sustituta?: boolean,
 * }} sol
 * @param {string} revisorPersonaId
 * @param {{ rrhhSustituto?: boolean }} [opts] — true si callable RRHH huérfana (A4)
 */
function revisorPuedeAutorizarJerarquico(sol, revisorPersonaId, opts = {}) {
  const rev = String(revisorPersonaId || "").trim();
  if (!RX_PER.test(rev)) return false;

  if (sol?.autorizacion_rrhh_sustituta === true && opts.rrhhSustituto === true) {
    return true;
  }

  const ids = Array.isArray(sol?.autorizadores_elegibles_ids)
    ? sol.autorizadores_elegibles_ids.map((x) => String(x || "").trim())
    : [];
  return ids.includes(rev);
}

/**
 * Revalidación F3 al resolver (snapshot o recálculo).
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   titular_persona_id: string,
 *   grupo_trabajo_id_ancla: string,
 *   fecha_desde: string,
 *   autorizadores_elegibles_ids?: string[],
 * }} sol
 * @param {string} revisorPersonaId
 */
async function revalidarRevisorEnAutorizadores(db, sol, revisorPersonaId) {
  const cadena = await resolverCadenaAutorizacion(db, {
    titularPersonaId: String(sol.titular_persona_id || ""),
    grupoTrabajoIdAncla: String(sol.grupo_trabajo_id_ancla || ""),
    fechaRefYmd: String(sol.fecha_desde || "").slice(0, 10),
  });
  if (!cadena.ok) {
    return { ok: false, codigo: cadena.codigo, mensaje: cadena.mensaje };
  }
  const solVirtual = buildAutorizacionSnapshotFields(cadena);
  return revisorPuedeAutorizarJerarquico(solVirtual, revisorPersonaId)
    ? { ok: true, cadena }
    : {
        ok: false,
        codigo: CODIGO_PERMISOS_JERARQUICOS_CAMBIADOS,
      };
}

module.exports = {
  MAX_DEPTH_ESCALAMIENTO,
  escalarGrupoPadre,
  resolverAutorizadoresElegiblesEnGrupo,
  resolverCadenaAutorizacion,
  buildAutorizacionSnapshotFields,
  revisorPuedeAutorizarJerarquico,
  revalidarRevisorEnAutorizadores,
  autorizadoresCandidatosEnGrupo,
  reducirAutorizadoresPorMejorRango,
};
