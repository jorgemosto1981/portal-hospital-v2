/**
 * Helpers de árbol GDT para el Módulo A (plantel).
 * Fuente: catálogo `grupos_de_trabajo` + opcional filtrado por raíces HLg (modo jefe).
 */

const RX_GDT = /^gdt_/i;

/**
 * @param {unknown} row
 * @returns {{ id: string, nombre: string, parent_group_id: string | null, activo: boolean } | null}
 */
export function normalizarNodoGdt(row) {
  if (!row || typeof row !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const id = String(r.id || "").trim();
  if (!RX_GDT.test(id)) return null;
  const parentRaw = r.parent_group_id ?? r.parentGroupId ?? null;
  const parent =
    parentRaw == null || parentRaw === ""
      ? null
      : String(parentRaw).trim() || null;
  const nombre =
    String(r.nombre || r.nombre_corto || r.codigo || r.titulo || "").trim() || id;
  return {
    id,
    nombre,
    parent_group_id: parent && RX_GDT.test(parent) ? parent : null,
    activo: r.activo !== false,
  };
}

/**
 * @param {unknown[]} rows
 * @returns {Array<{ id: string, nombre: string, parent_group_id: string | null, activo: boolean }>}
 */
export function listarGdtActivos(rows) {
  const out = [];
  for (const row of rows || []) {
    const n = normalizarNodoGdt(row);
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
export function expandirSubarbolIds(nodos, raizIds) {
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
 * Árbol anidado; solo nodos cuyo id está en `visibleIds` (si se pasa).
 * Raíces = sin padre o padre fuera del conjunto visible.
 *
 * @param {Array<{ id: string, nombre: string, parent_group_id: string | null }>} nodos
 * @param {Set<string> | null} [visibleIds]
 * @returns {Array<{ id: string, nombre: string, children: unknown[] }>}
 */
export function construirArbolGdt(nodos, visibleIds = null) {
  const filtered =
    visibleIds == null
      ? [...(nodos || [])]
      : (nodos || []).filter((n) => visibleIds.has(n.id));

  const byId = new Map(filtered.map((n) => [n.id, { id: n.id, nombre: n.nombre, children: [] }]));
  /** @type {Array<{ id: string, nombre: string, children: unknown[] }>} */
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
 * Extrae ids de GDT desde filas `grupos_trabajo_vigentes` del resolver laboral.
 * @param {unknown[]} gruposVigentes
 * @returns {string[]}
 */
export function idsGdtDesdeGruposVigentes(gruposVigentes) {
  const ids = [];
  for (const g of gruposVigentes || []) {
    if (!g || typeof g !== "object") continue;
    const r = /** @type {Record<string, unknown>} */ (g);
    const id = String(r.grupo_de_trabajo_id || r.grupo_trabajo_id || r.id || "").trim();
    if (RX_GDT.test(id)) ids.push(id);
  }
  return [...new Set(ids)];
}
