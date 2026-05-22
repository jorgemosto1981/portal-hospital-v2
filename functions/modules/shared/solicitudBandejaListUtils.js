"use strict";

const COL_PERSONAS = "personas";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * @param {unknown} raw
 * @param {{ filtroDefault?: string }} [cfg]
 */
function parseBandejaListPageOpts(raw, cfg = {}) {
  const o = raw && typeof raw === "object" ? raw : {};
  const filtroVista =
    String(o.filtro_vista || cfg.filtroDefault || "pendientes").trim() ||
    cfg.filtroDefault ||
    "pendientes";
  const dni = String(o.dni || "")
    .replace(/\D/g, "")
    .trim();
  const usuario = String(o.usuario || "")
    .trim()
    .toLowerCase();
  const cursor = String(o.cursor || "").trim();
  const requested = Number(o.page_size);
  const pageSize = Number.isFinite(requested)
    ? Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(requested)))
    : DEFAULT_PAGE_SIZE;
  return { filtroVista, dni, usuario, cursor, pageSize };
}

/**
 * @param {Array<Record<string, unknown>>} sorted
 * @param {{ cursor: string, pageSize: number }} page
 */
function paginarBandejaOrdenada(sorted, page) {
  let start = 0;
  if (page.cursor) {
    const idx = sorted.findIndex((s) => String(s.solicitud_id) === page.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(start, start + page.pageSize);
  const hasMore = start + page.pageSize < sorted.length;
  const nextCursor =
    hasMore && slice.length > 0 ? String(slice[slice.length - 1].solicitud_id || "") : null;
  return {
    solicitudes: slice,
    has_more: hasMore,
    next_cursor: nextCursor,
    total_filtrado: sorted.length,
  };
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 * @param {string} dniDigits
 */
async function resolverPersonaIdsPorDni(db, dniDigits) {
  if (!dniDigits) return null;
  const snap = await db.collection(COL_PERSONAS).where("dni", "==", dniDigits).limit(5).get();
  const ids = snap.docs.map((d) => d.id).filter((id) => /^per_/i.test(id));
  return ids.length ? new Set(ids) : new Set();
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseBandejaListPageOpts,
  paginarBandejaOrdenada,
  resolverPersonaIdsPorDni,
};
