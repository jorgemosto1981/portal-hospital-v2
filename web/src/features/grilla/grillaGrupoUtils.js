/** @typedef {{ grupo_de_trabajo_id?: string; etiqueta_ui?: string }} GrupoVigenteRow */

export const RX_GDT = /^gdt_/i;

export function normalizeGrupoTrabajoId(value) {
  return String(value || "").trim();
}

/**
 * @param {unknown} value
 * @param {string} [message]
 * @returns {string} gdt_*
 */
export function assertGrupoTrabajoId(
  value,
  message = "Elegí un grupo de trabajo (cargo) para continuar.",
) {
  const gdt = normalizeGrupoTrabajoId(value);
  if (!RX_GDT.test(gdt)) {
    throw new Error(message);
  }
  return gdt;
}

/**
 * @param {GrupoVigenteRow[]} grupos
 * @param {string} gdt
 */
export function etiquetaGrupoDesdeLista(grupos, gdt) {
  const id = normalizeGrupoTrabajoId(gdt);
  const row = (grupos || []).find((g) => normalizeGrupoTrabajoId(g.grupo_de_trabajo_id) === id);
  return String(row?.etiqueta_ui || id || "").trim();
}

/**
 * @param {GrupoVigenteRow[]} grupos
 * @param {string} prev
 * @param {string} sugerido
 */
export function resolverGrupoIdInicial(grupos, prev, sugerido) {
  const ids = (grupos || [])
    .map((g) => normalizeGrupoTrabajoId(g.grupo_de_trabajo_id))
    .filter((id) => RX_GDT.test(id));
  const p = normalizeGrupoTrabajoId(prev);
  if (p && ids.includes(p)) return p;
  const s = normalizeGrupoTrabajoId(sugerido);
  if (s && ids.includes(s)) return s;
  if (ids.length === 1) return ids[0];
  return "";
}
