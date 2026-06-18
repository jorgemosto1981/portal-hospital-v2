import {
  buildCellKey,
  normalizeFechaYmd,
  normalizeGdtId,
  normalizePersonaId,
  parseCellKey,
} from "./grillaMesNodoKeys.js";
import { nodosAfectadosPorOp, nodosAfectadosPorOps, paresCeldaDesdeOp } from "./grillaMesNodoImpacto.js";

/**
 * @typedef {Record<string, unknown>} CeldaVisSnapshot
 * @typedef {{
 *   pending: boolean;
 *   opIds: string[];
 *   celda?: CeldaVisSnapshot | null;
 * }} OutboxOverlay
 * @typedef {{
 *   revision: number;
 *   base: CeldaVisSnapshot | null;
 *   overlay: OutboxOverlay | null;
 *   pending: boolean;
 * }} CeldaView
 */

const RX_DIA_KEY = /^(0[1-9]|[12]\d|3[01])$/;

/**
 * @param {Record<string, unknown>} vista
 * @param {string} gdt
 * @param {number} anio
 * @param {number} mes
 * @returns {Generator<{ key: string; celda: CeldaVisSnapshot }>}
 */
export function* iterCeldasDesdeVistaListado(vista, gdt, anio, mes) {
  const gdtNorm = normalizeGdtId(gdt || vista?.grupo_trabajo_id);
  const y = Number(anio ?? vista?.anio);
  const m = Number(mes ?? vista?.mes);
  if (!gdtNorm || !Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return;
  const mm = String(m).padStart(2, "0");
  const filas = Array.isArray(vista?.filas) ? vista.filas : [];
  for (const fila of filas) {
    const persona_id = normalizePersonaId(fila?.persona_id);
    if (!persona_id) continue;
    const dias = fila?.dias && typeof fila.dias === "object" ? fila.dias : {};
    for (const [diaKey, celda] of Object.entries(dias)) {
      if (!RX_DIA_KEY.test(String(diaKey))) continue;
      if (!celda || typeof celda !== "object") continue;
      const fecha_ymd = `${y}-${mm}-${diaKey}`;
      const key = buildCellKey({ gdt: gdtNorm, persona_id, fecha_ymd });
      yield { key, celda: /** @type {CeldaVisSnapshot} */ ({ ...celda }) };
    }
  }
}

/**
 * @param {Record<string, unknown>} op
 */
function opIdDesdeOp(op) {
  return String(op?.id || op?.op_id || "").trim();
}

/**
 * Store de nodos celda (base vis + overlay outbox). Módulo puro, sin React.
 * @param {{ onCellsChanged?: (keys: Set<string>) => void }} [options]
 */
export function createGrillaMesNodoStore(options = {}) {
  /** @type {Map<string, CeldaVisSnapshot>} */
  const base = new Map();
  /** @type {Map<string, OutboxOverlay>} */
  const overlay = new Map();
  /** @type {Map<string, number>} */
  const revision = new Map();
  /** @type {Map<string, Set<string>>} opId → cell keys */
  const opToCells = new Map();
  /** @type {Map<string, Set<string>>} cell key → op ids */
  const cellToOps = new Map();

  /** @type {{ gdt: string; anio: number; mes: number } | null} */
  let contexto = null;

  /** @type {Set<(keys: Set<string>) => void>} */
  const listeners = new Set();
  if (typeof options.onCellsChanged === "function") {
    listeners.add(options.onCellsChanged);
  }

  function notify(keys) {
    if (!keys.size) return;
    for (const fn of listeners) {
      try {
        fn(keys);
      } catch {
        /* listener */
      }
    }
  }

  function bumpRevision(key, deltaKeys) {
    const next = (revision.get(key) || 0) + 1;
    revision.set(key, next);
    deltaKeys.add(key);
  }

  function syncOverlayForKey(key, deltaKeys) {
    const opIds = cellToOps.get(key);
    const ids = opIds ? [...opIds] : [];
    if (!ids.length) {
      if (overlay.delete(key)) bumpRevision(key, deltaKeys);
      return;
    }
    const prev = overlay.get(key);
    const next = {
      pending: true,
      opIds: ids,
      celda: prev?.celda ?? null,
      reemplazaBase: prev?.reemplazaBase === true,
    };
    overlay.set(key, next);
    bumpRevision(key, deltaKeys);
  }

  function indexOpOnCells(opId, cellKeys, deltaKeys) {
    opToCells.set(opId, new Set(cellKeys));
    for (const key of cellKeys) {
      let set = cellToOps.get(key);
      if (!set) {
        set = new Set();
        cellToOps.set(key, set);
      }
      if (!set.has(opId)) {
        set.add(opId);
        syncOverlayForKey(key, deltaKeys);
      }
    }
  }

  function unindexOp(opId, deltaKeys) {
    const keys = opToCells.get(opId);
    if (!keys) return;
    opToCells.delete(opId);
    for (const key of keys) {
      const set = cellToOps.get(key);
      if (set) {
        set.delete(opId);
        if (!set.size) cellToOps.delete(key);
      }
      syncOverlayForKey(key, deltaKeys);
    }
  }

  /**
   * @param {(keys: Set<string>) => void} listener
   * @returns {() => void}
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function resetIndices() {
    opToCells.clear();
    cellToOps.clear();
    overlay.clear();
  }

  /**
   * Carga nodos base desde payload listarVistaGrillaMesPorGrupo.
   * Limpia overlay e índices (re-hidratar outbox es responsabilidad del hook).
   * @param {Record<string, unknown>} vista
   * @param {{ conservarOverlay?: boolean }} [opts]
   */
  function hidratarDesdeListadoVista(vista, opts = {}) {
    const gdt = normalizeGdtId(vista?.grupo_trabajo_id);
    const anio = Number(vista?.anio);
    const mes = Number(vista?.mes);
    if (!gdt || !Number.isFinite(anio) || !Number.isFinite(mes)) {
      throw new Error("hidratarDesdeListadoVista: vista incompleta (gdt, anio, mes)");
    }
    const changed = new Set();
    base.clear();
    revision.clear();
    if (!opts.conservarOverlay) {
      resetIndices();
    }
    for (const { key, celda } of iterCeldasDesdeVistaListado(vista, gdt, anio, mes)) {
      base.set(key, celda);
      revision.set(key, 1);
      changed.add(key);
    }
    contexto = { gdt, anio, mes };
    notify(changed);
  }

  /**
   * @param {Record<string, unknown>} op — debe incluir `id` (outbox)
   * @param {{ celdaProyectada?: CeldaVisSnapshot | null }} [opts]
   */
  function aplicarOpLocal(op, opts = {}) {
    const opId = opIdDesdeOp(op);
    if (!opId) throw new Error("aplicarOpLocal: op sin id");
    const delta = new Set();
    if (opToCells.has(opId)) unindexOp(opId, delta);
    const cellKeys = nodosAfectadosPorOp(op);
    indexOpOnCells(opId, cellKeys, delta);
    if (opts.celdaProyectada && typeof opts.celdaProyectada === "object") {
      for (const key of cellKeys) {
        const o = overlay.get(key);
        if (o) {
          overlay.set(key, { ...o, celda: { ...opts.celdaProyectada } });
          bumpRevision(key, delta);
        }
      }
    }
    notify(delta);
    return { opId, cellKeys };
  }

  /**
   * @param {string} opId
   */
  function revocarOpLocal(opId) {
    const id = String(opId || "").trim();
    if (!id) return;
    const delta = new Set();
    unindexOp(id, delta);
    notify(delta);
  }

  /**
   * @param {string} cellKey
   * @param {CeldaVisSnapshot} celda
   */
  function parchearCeldaBase(cellKey, celda) {
    const key = String(cellKey || "").trim();
    if (!parseCellKey(key) || !celda || typeof celda !== "object") return;
    const delta = new Set();
    base.set(key, { ...celda });
    if (!revision.has(key)) revision.set(key, 0);
    bumpRevision(key, delta);
    notify(delta);
  }

  /**
   * @param {string[]} opIds
   * @param {Array<{ persona_id?: string; fecha_ymd?: string; celda?: CeldaVisSnapshot; gdt?: string }>} [parchesVis]
   */
  function confirmarBatch(opIds, parchesVis) {
    const delta = new Set();
    const gdt = contexto?.gdt || "";
    for (const patch of parchesVis || []) {
      const pid = normalizePersonaId(patch.persona_id);
      const fy = normalizeFechaYmd(patch.fecha_ymd);
      const g = normalizeGdtId(patch.gdt || patch.grupo_trabajo_id || gdt);
      if (!pid || !fy || !g || !patch.celda) continue;
      const key = buildCellKey({ gdt: g, persona_id: pid, fecha_ymd: fy });
      base.set(key, { ...patch.celda });
      if (!revision.has(key)) revision.set(key, 0);
      bumpRevision(key, delta);
    }
    for (const opId of opIds || []) {
      unindexOp(String(opId || "").trim(), delta);
    }
    notify(delta);
  }

  /**
   * @param {string} cellKey
   * @returns {CeldaView}
   */
  function getCelda(cellKey) {
    const key = String(cellKey || "").trim();
    const rev = revision.get(key) || 0;
    const snap = base.get(key) ?? null;
    const ov = overlay.get(key) ?? null;
    return {
      revision: rev,
      base: snap,
      overlay: ov,
      pending: Boolean(ov?.pending),
    };
  }

  /**
   * Celda merge superficial: overlay.celda sobre base (preview optimista).
   * @param {string} cellKey
   */
  function getCeldaMerged(cellKey) {
    const view = getCelda(cellKey);
    const ov = view.overlay;
    if (ov?.celda && typeof ov.celda === "object") {
      if (ov.reemplazaBase === true) return { ...ov.celda };
      if (!view.base) return { ...ov.celda };
      return { ...view.base, ...ov.celda };
    }
    return view.base;
  }

  /**
   * Tras indexar ops locales, proyecta celda vis final (sin capa fichada/analítica previa) en overlay.
   * @param {Array<Record<string, unknown>>} ops
   * @param {(args: { cellKey: string, cell: CeldaVisSnapshot, ops: Array<Record<string, unknown>> }) => CeldaVisSnapshot | null | undefined} proyectar
   */
  function actualizarOverlaysProyectadosOutbox(ops, proyectar) {
    const delta = new Set();
    const keys = nodosAfectadosPorOps(ops);
    for (const key of keys) {
      const opIds = cellToOps.get(key);
      if (!opIds?.size) continue;
      const baseSnap = base.get(key);
      if (!baseSnap) continue;
      const celdaProj = proyectar({
        cellKey: key,
        cell: baseSnap,
        ops: ops || [],
      });
      if (!celdaProj || typeof celdaProj !== "object") continue;
      overlay.set(key, {
        pending: true,
        opIds: [...opIds],
        celda: celdaProj,
        reemplazaBase: true,
      });
      bumpRevision(key, delta);
    }
    notify(delta);
  }

  function getRevision(cellKey) {
    return revision.get(String(cellKey || "").trim()) || 0;
  }

  function getOpsEnCelda(cellKey) {
    const set = cellToOps.get(String(cellKey || "").trim());
    return set ? [...set] : [];
  }

  function listOpIdsEnIndice() {
    return [...opToCells.keys()];
  }

  function getContexto() {
    return contexto ? { ...contexto } : null;
  }

  function clear() {
    base.clear();
    overlay.clear();
    revision.clear();
    resetIndices();
    contexto = null;
    notify(new Set([...revision.keys()]));
  }

  return {
    subscribe,
    hidratarDesdeListadoVista,
    aplicarOpLocal,
    revocarOpLocal,
    confirmarBatch,
    parchearCeldaBase,
    actualizarOverlaysProyectadosOutbox,
    getCelda,
    getCeldaMerged,
    getRevision,
    getOpsEnCelda,
    listOpIdsEnIndice,
    getContexto,
    clear,
    /** expuesto para tests */
    _paresCeldaDesdeOp: paresCeldaDesdeOp,
  };
}
