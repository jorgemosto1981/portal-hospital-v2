"use strict";

/**
 * Árbol GDT visible para plantel — RFC_PLANTEL_Y_PASES_GDT_V2.md §3 (Fase 1b).
 * RRHH: todos los GDT activos. Jefe: HLg vigentes + descendientes por parent_group_id.
 */

const { COL_GRUPOS_TRABAJO } = require("../shared/constants");
const { listarGruposTrabajoVigentesEnFecha } = require("../shared/solicitudGrupoTrabajoAncla");
const { normalizeYmd } = require("./obtenerPlantelPorGdtCore");

const RX_GDT = /^gdt_/i;
const DEFAULT_LIMIT = 500;

/**
 * @param {unknown} row
 * @param {string} id
 * @returns {{ id: string, nombre: string, parent_group_id: string | null, activo: boolean } | null}
 */
function normalizarNodoGdt(row, id) {
  if (!row || typeof row !== "object") return null;
  const docId = String(id || "").trim();
  if (!RX_GDT.test(docId)) return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const parentRaw = r.parent_group_id ?? r.parentGroupId ?? null;
  const parent =
    parentRaw == null || parentRaw === ""
      ? null
      : String(parentRaw).trim() || null;
  const nombre =
    String(r.nombre || r.nombre_corto || r.codigo || r.titulo || "").trim() || docId;
  return {
    id: docId,
    nombre,
    parent_group_id: parent && RX_GDT.test(parent) ? parent : null,
    activo: r.activo !== false,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ id: string, nombre: string, parent_group_id: string | null, activo: boolean }>>}
 */
async function loadNodosGdtActivos(db, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_LIMIT, 1), 1000);
  const snap = await db.collection(COL_GRUPOS_TRABAJO).limit(limit).get();
  const out = [];
  for (const doc of snap.docs) {
    const n = normalizarNodoGdt(doc.data() || {}, doc.id);
    if (n && n.activo) out.push(n);
  }
  out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return out;
}

/**
 * IDs visibles = raíces + todos los descendientes por `parent_group_id`.
 * @param {Array<{ id: string, parent_group_id: string | null }>} nodos
 * @param {string[]} raizIds
 * @returns {Set<string>}
 */
function expandirSubarbolIds(nodos, raizIds) {
  const roots = new Set(
    (raizIds || []).map((x) => String(x || "").trim()).filter((id) => RX_GDT.test(id)),
  );
  if (roots.size === 0) return new Set();

  /** @type {Map<string, string[]>} */
  const childrenByParent = new Map();
  for (const n of nodos || []) {
    const pid = n.parent_group_id;
    if (!pid) continue;
    const list = childrenByParent.get(pid) || [];
    list.push(n.id);
    childrenByParent.set(pid, list);
  }

  const visible = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    const id = queue.shift();
    const kids = childrenByParent.get(id) || [];
    for (const kid of kids) {
      if (visible.has(kid)) continue;
      visible.add(kid);
      queue.push(kid);
    }
  }
  return visible;
}

/**
 * @param {Array<{ id: string, nombre: string, parent_group_id: string | null }>} nodos
 * @param {Set<string> | null} [visibleIds]
 * @returns {Array<{ id: string, nombre: string, parent_group_id: string | null, children: unknown[] }>}
 */
function construirArbolGdt(nodos, visibleIds = null) {
  const filtered =
    visibleIds == null
      ? [...(nodos || [])]
      : (nodos || []).filter((n) => visibleIds.has(n.id));

  const byId = new Map(
    filtered.map((n) => [
      n.id,
      {
        id: n.id,
        nombre: n.nombre,
        parent_group_id: n.parent_group_id,
        children: [],
      },
    ]),
  );
  /** @type {Array<{ id: string, nombre: string, parent_group_id: string | null, children: unknown[] }>} */
  const roots = [];

  for (const n of filtered) {
    const node = byId.get(n.id);
    if (!node) continue;
    const parentId = n.parent_group_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (list) => {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    for (const c of list) sortRec(c.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * ¿`gdtId` es raíz HLg o descendiente de alguna raíz? (sube por parent_group_id).
 * @param {Map<string, { id: string, parent_group_id: string | null }>} byId
 * @param {string} gdtId
 * @param {Set<string>} raizIds
 * @returns {boolean}
 */
function gdtEnSubarbolDeRaices(byId, gdtId, raizIds) {
  const target = String(gdtId || "").trim();
  if (!RX_GDT.test(target) || !raizIds || raizIds.size === 0) return false;
  if (raizIds.has(target)) return true;

  let cur = target;
  const seen = new Set();
  while (cur && RX_GDT.test(cur) && !seen.has(cur)) {
    seen.add(cur);
    if (raizIds.has(cur)) return true;
    const node = byId.get(cur);
    if (!node) return false;
    const parent = node.parent_group_id;
    if (!parent) return false;
    cur = parent;
  }
  return false;
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} personaId
 * @param {string} aFechaYmd
 * @returns {Promise<string[]>}
 */
async function resolverRaicesJefe(db, personaId, aFechaYmd) {
  const vigentes = await listarGruposTrabajoVigentesEnFecha(db, personaId, aFechaYmd);
  return [
    ...new Set(
      vigentes
        .map((g) => String(g.grupo_de_trabajo_id || "").trim())
        .filter((id) => RX_GDT.test(id)),
    ),
  ];
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   alcance: "rrhh" | "jefe";
 *   personaId?: string | null;
 *   aFechaYmd: string;
 * }} args
 */
async function listarArbolGdtPlantelCore(db, { alcance, personaId, aFechaYmd }) {
  const fecha = normalizeYmd(aFechaYmd);
  if (!fecha) {
    return { ok: false, code: "invalid-argument", message: "a_fecha inválida (YYYY-MM-DD)." };
  }

  const modo = alcance === "jefe" ? "jefe" : "rrhh";
  const nodos = await loadNodosGdtActivos(db);

  if (modo === "rrhh") {
    return {
      ok: true,
      alcance: "rrhh",
      a_fecha: fecha,
      raices_ids: [],
      nodos,
      arbol: construirArbolGdt(nodos),
      total: nodos.length,
    };
  }

  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Sin persona_id: no se puede acotar la rama de jefatura.",
    };
  }

  const raicesIds = await resolverRaicesJefe(db, pid, fecha);
  if (raicesIds.length === 0) {
    return {
      ok: true,
      alcance: "jefe",
      a_fecha: fecha,
      raices_ids: [],
      nodos: [],
      arbol: [],
      total: 0,
      aviso: "Sin HLg vigente: no hay rama de jefatura para mostrar.",
    };
  }

  const visible = expandirSubarbolIds(nodos, raicesIds);
  const nodosVisibles = nodos.filter((n) => visible.has(n.id));
  return {
    ok: true,
    alcance: "jefe",
    a_fecha: fecha,
    raices_ids: raicesIds,
    nodos: nodosVisibles,
    arbol: construirArbolGdt(nodos, visible),
    total: nodosVisibles.length,
  };
}

/**
 * Auth lectura plantel: RRHH OK; jefe si el GDT está en su subárbol de mando.
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {{
 *   gdtId: string;
 *   personaId: string;
 *   aFechaYmd: string;
 *   esRrhh: boolean;
 * }} args
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message: string }>}
 */
async function assertLecturaPlantelJurisdiccion(db, { gdtId, personaId, aFechaYmd, esRrhh }) {
  if (esRrhh) return { ok: true };

  const fecha = normalizeYmd(aFechaYmd);
  if (!fecha) {
    return { ok: false, code: "invalid-argument", message: "a_fecha inválida (YYYY-MM-DD)." };
  }
  const pid = String(personaId || "").trim();
  if (!/^per_/i.test(pid)) {
    return { ok: false, code: "permission-denied", message: "Sin persona vinculada." };
  }

  const target = String(gdtId || "").trim();
  if (!RX_GDT.test(target)) {
    return { ok: false, code: "invalid-argument", message: "gdt_id inválido." };
  }

  const [nodos, raicesIds] = await Promise.all([
    loadNodosGdtActivos(db),
    resolverRaicesJefe(db, pid, fecha),
  ]);
  if (raicesIds.length === 0) {
    return {
      ok: false,
      code: "permission-denied",
      message: "Sin HLg vigente: no podés consultar plantel de este grupo.",
    };
  }

  const byId = new Map(nodos.map((n) => [n.id, n]));
  // Si el GDT no está en el catálogo activo cargado, denegar (MVP solo activos).
  if (!byId.has(target)) {
    return {
      ok: false,
      code: "permission-denied",
      message: "El grupo no está en tu jurisdicción de plantel.",
    };
  }

  const raizSet = new Set(raicesIds);
  if (!gdtEnSubarbolDeRaices(byId, target, raizSet)) {
    return {
      ok: false,
      code: "permission-denied",
      message: "El grupo no está en tu jurisdicción de plantel (rama HLg + sub-GDT).",
    };
  }
  return { ok: true };
}

module.exports = {
  normalizarNodoGdt,
  loadNodosGdtActivos,
  expandirSubarbolIds,
  construirArbolGdt,
  gdtEnSubarbolDeRaices,
  resolverRaicesJefe,
  listarArbolGdtPlantelCore,
  assertLecturaPlantelJurisdiccion,
};
