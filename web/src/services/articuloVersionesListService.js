import { doc, getDoc } from "firebase/firestore";

import { getCorrespondenciaAnioFromVersion } from "../../../shared/utils/laoVersionResolver.js";
import { callListarVersionesCfgArticulo } from "./callables.js";
import { dbV2 as db } from "./firebase.js";

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function formatPublicadaEn(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      try {
        return new Date(s).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
      } catch {
        return s.slice(0, 16);
      }
    }
    return s;
  }
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} versionId
 * @param {Record<string, unknown>} data
 * @returns {{
 *   versionId: string,
 *   estadoVersionId: string,
 *   versionSemantica: string,
 *   correspondenciaAnio: number | null,
 *   esLaoAnual: boolean,
 *   publicadaEn: string | null,
 * }}
 */
export function mapVersionDataToRow(versionId, data) {
  const d = data && typeof data === "object" ? data : {};
  const esLaoAnual = d?.bloque_identidad_naturaleza?.es_lao_anual === true;
  const correspondenciaAnio = getCorrespondenciaAnioFromVersion(d);
  return {
    versionId: String(versionId || "").trim(),
    estadoVersionId: String(d.estado_version_id || "").trim(),
    versionSemantica: String(d.version_semantica || "").trim() || "—",
    correspondenciaAnio,
    esLaoAnual,
    publicadaEn: formatPublicadaEn(d.publicada_en),
  };
}

/**
 * @param {import("firebase/firestore").DocumentSnapshot} verSnap
 */
export function mapVersionDocToRow(verSnap) {
  return mapVersionDataToRow(verSnap.id, verSnap.data() || {});
}

/**
 * @param {ReturnType<typeof mapVersionDocToRow>[]} rows
 */
export function sortVersionRows(rows) {
  return [...rows].sort((a, b) => {
    const ya = a.correspondenciaAnio;
    const yb = b.correspondenciaAnio;
    if (ya != null && yb != null && ya !== yb) return yb - ya;
    if (ya != null && yb == null) return -1;
    if (ya == null && yb != null) return 1;
    return b.versionId.localeCompare(a.versionId);
  });
}

/**
 * Solo subcolección `versiones` (el núcleo del artículo debe venir de otro listado).
 * @param {string} articuloId
 * @param {{ resumenOnly?: boolean }} [opts]
 * @returns {Promise<ReturnType<typeof mapVersionDocToRow>[]>}
 */
export async function loadVersionesSubcoleccion(articuloId, opts = {}) {
  const art = String(articuloId || "").trim();
  if (!/^art_/i.test(art)) {
    return [];
  }
  const resumenOnly = opts.resumenOnly !== false;
  const res = await callListarVersionesCfgArticulo({ articuloId: art, resumenOnly });
  const payload = res?.data;
  const items =
    payload && typeof payload === "object" && Array.isArray(payload.items) ? payload.items : [];
  const rows = items
    .map((it) =>
      mapVersionDataToRow(
        typeof it?.versionId === "string" ? it.versionId : "",
        it?.data && typeof it.data === "object" ? it.data : {},
      ),
    )
    .filter((r) => /^ver_[0-9A-HJKMNP-TV-Z]{26}$/i.test(r.versionId));
  return sortVersionRows(rows);
}

/**
 * Carga versiones de varios artículos con límite de concurrencia (evita saturar callables).
 * Respeta `signal` (AbortSignal) para cortar al desmontar o al navegar a Gestionar.
 *
 * @param {string[]} articuloIds
 * @param {{
 *   concurrency?: number,
 *   signal?: AbortSignal,
 *   onItem?: (articuloId: string, rows: ReturnType<typeof mapVersionDocToRow>[]) => void,
 * }} [opts]
 */
export async function loadVersionesSubcoleccionBatch(articuloIds, opts = {}) {
  const ids = [...new Set((articuloIds || []).map((x) => String(x || "").trim()).filter((id) => /^art_/i.test(id)))];
  const concurrency = Math.max(1, Math.min(Number(opts.concurrency) || 2, 4));
  const onItem = typeof opts.onItem === "function" ? opts.onItem : null;
  const signal = opts.signal;
  /** @type {Record<string, ReturnType<typeof mapVersionDocToRow>[]>} */
  const out = {};
  let cursor = 0;

  function aborted() {
    return Boolean(signal && signal.aborted);
  }

  async function worker() {
    while (!aborted() && cursor < ids.length) {
      const i = cursor;
      cursor += 1;
      const id = ids[i];
      if (aborted()) break;
      try {
        const rows = await loadVersionesSubcoleccion(id, { resumenOnly: true });
        if (aborted()) break;
        out[id] = rows;
        if (onItem) onItem(id, rows);
      } catch {
        if (aborted()) break;
        out[id] = [];
        if (onItem) onItem(id, []);
      }
    }
  }

  if (ids.length === 0 || aborted()) return out;
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
  return out;
}

/**
 * @param {string} articuloId
 * @returns {Promise<{
 *   articulo: { id: string, codigo: string, nombre: string, versionActualId: string | null },
 *   versiones: ReturnType<typeof mapVersionDocToRow>[],
 * }>}
 */
export async function loadArticuloVersionesList(articuloId) {
  const art = String(articuloId || "").trim();
  if (!/^art_/i.test(art)) {
    throw new Error("articulo_id inválido.");
  }

  const [coreSnap, versiones] = await Promise.all([
    getDoc(doc(db, "cfg_articulos", art)),
    loadVersionesSubcoleccion(art),
  ]);

  if (!coreSnap.exists()) {
    throw new Error("El artículo no existe.");
  }

  const core = coreSnap.data() || {};
  const versionActualId =
    typeof core.version_actual_id === "string" ? core.version_actual_id.trim() : null;

  return {
    articulo: {
      id: art,
      codigo: String(core.codigo || "").trim(),
      nombre: String(core.nombre || "").trim(),
      versionActualId,
    },
    versiones,
  };
}