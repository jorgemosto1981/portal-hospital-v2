"use strict";

/**
 * Calcula `jefes_pendientes_conocimiento_ids` para un pase GDT ejecutado.
 * SPIKE_PASES_GDT_FASE2_V2.md §5 — subir parent_group_id desde origen/destino.
 */

const {
  MAX_DEPTH_ESCALAMIENTO,
  escalarGrupoPadre,
  resolverAutorizadoresElegiblesEnGrupo,
} = require("../shared/solicitudAutorizacionJerarquicaCore");
const {
  loadHlgRowsPorPersona,
  filterHlgVigentesEnFecha,
  nivelTitularEnGrupo,
} = require("../shared/solicitudHlgVigencia");

const RX_PER = /^per_/i;
const RX_GDT = /^gdt_/i;
const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ancestros (padres) de un GDT, sin incluir el nodo semilla.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} gdtId
 * @returns {Promise<string[]>}
 */
async function listarAncestrosGdt(db, gdtId) {
  const seed = String(gdtId || "").trim();
  if (!RX_GDT.test(seed)) return [];

  /** @type {string[]} */
  const out = [];
  const visited = new Set();
  let current = seed;

  for (let depth = 0; depth <= MAX_DEPTH_ESCALAMIENTO; depth += 1) {
    visited.add(current);
    const esc = await escalarGrupoPadre(db, current, visited);
    if (!esc.ok) break;
    const padre = esc.parent_group_id;
    if (!padre) break;
    out.push(padre);
    current = padre;
  }
  return out;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   agentePersonaId: string;
 *   gdtOrigenId: string;
 *   gdtDestinoId?: string | null;
 *   fechaRefYmd: string;
 *   excluirPersonaIds?: string[];
 * }} input
 * @returns {Promise<string[]>}
 */
async function calcularJefesPendientesConocimientoPaseGdt(db, input) {
  const agentePersonaId = String(input.agentePersonaId || "").trim();
  const gdtOrigenId = String(input.gdtOrigenId || "").trim();
  const gdtDestinoId = String(input.gdtDestinoId || "").trim();
  const fechaRefYmd = String(input.fechaRefYmd || "").slice(0, 10);
  const excluir = new Set(
    [...(input.excluirPersonaIds || []), agentePersonaId]
      .map((x) => String(x || "").trim())
      .filter((x) => RX_PER.test(x)),
  );

  if (!RX_PER.test(agentePersonaId) || !RX_YMD.test(fechaRefYmd)) {
    return [];
  }

  /** @type {Set<string>} */
  const ancestors = new Set();
  for (const seed of [gdtOrigenId, gdtDestinoId]) {
    if (!RX_GDT.test(seed)) continue;
    for (const a of await listarAncestrosGdt(db, seed)) {
      ancestors.add(a);
    }
  }
  if (ancestors.size === 0) return [];

  const hlgAgente = await loadHlgRowsPorPersona(db, agentePersonaId);
  const vigentesAgente = filterHlgVigentesEnFecha(hlgAgente, fechaRefYmd);
  let nivelAgente = null;
  if (RX_GDT.test(gdtOrigenId)) {
    nivelAgente = nivelTitularEnGrupo(vigentesAgente, gdtOrigenId);
  }
  if (nivelAgente === null && vigentesAgente.length > 0) {
    const raw = vigentesAgente[0].nivel_jerarquico;
    const n = Number(raw);
    if (Number.isFinite(n)) nivelAgente = n;
  }

  /** @type {Set<string>} */
  const ids = new Set();
  for (const gdtId of ancestors) {
    const { autorizadores_elegibles_ids } = await resolverAutorizadoresElegiblesEnGrupo(db, {
      titularPersonaId: agentePersonaId,
      grupoTrabajoId: gdtId,
      nivelTitularAncla: nivelAgente,
      fechaRefYmd,
    });
    for (const pid of autorizadores_elegibles_ids || []) {
      const id = String(pid || "").trim();
      if (RX_PER.test(id) && !excluir.has(id)) ids.add(id);
    }
  }

  return [...ids].sort();
}

module.exports = {
  listarAncestrosGdt,
  calcularJefesPendientesConocimientoPaseGdt,
};
