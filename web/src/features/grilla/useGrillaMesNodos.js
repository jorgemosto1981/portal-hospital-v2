import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  buildCellKey,
  createGrillaMesNodoStore,
  normalizeGdtId,
  parseCellKey,
} from "../../../../shared/utils/grillaMesNodos/index.js";
import { fetchParchesVisDesdeOpsOutbox, mergeParchesVisLista, parchesVisDesdeRespuestaBatch } from "./grillaMesNodosBatchParches.js";
import { callObtenerVistaGrillaMesAgente } from "../../services/callables.js";

/** @typedef {ReturnType<typeof createGrillaMesNodoStore>} GrillaMesNodoStore */

/** @type {import("react").Context<GrillaMesNodosApi | null>} */
const GrillaMesNodosContext = createContext(null);

/**
 * @typedef {{
 *   revision: number;
 *   cell: Record<string, unknown>;
 *   pending: boolean;
 * }} CeldaRenderSnapshot
 */

/**
 * @typedef {{
 *   store: GrillaMesNodoStore;
 *   getCellRenderSnapshot: (cellKey: string) => CeldaRenderSnapshot;
 *   subscribeCell: (cellKey: string, listener: () => void) => () => void;
 *   confirmarBatch: GrillaMesNodoStore["confirmarBatch"];
 *   confirmarBatchTrasExito: (
 *     opsAplicadas: Array<Record<string, unknown>>,
 *     batchResult?: Record<string, unknown> | null,
 *   ) => Promise<
 *     Array<{
 *       persona_id: string;
 *       fecha_ymd: string;
 *       gdt: string;
 *       celda: Record<string, unknown>;
 *     }>
 *   >;
 *   bumpEpoch: number;
 * }} GrillaMesNodosApi
 */

function keyPerteneceContexto(cellKey, gdt, periodoYm) {
  const parts = parseCellKey(cellKey);
  if (!parts) return false;
  if (normalizeGdtId(parts.gdt) !== normalizeGdtId(gdt)) return false;
  const per = String(periodoYm || "").trim().slice(0, 7);
  if (!per) return true;
  return parts.fecha_ymd.startsWith(`${per}-`);
}

/**
 * Puente store de nodos + suscripción granular por celda.
 * @param {{
 *   grupoTrabajoId?: string;
 *   periodoYm?: string;
 *   vistaListado?: Record<string, unknown> | null;
 *   enabled?: boolean;
 * }} params
 */
export function useGrillaMesNodos({
  grupoTrabajoId = "",
  periodoYm = "",
  vistaListado = null,
  enabled = true,
}) {
  const storeRef = useRef(/** @type {GrillaMesNodoStore | null} */ (null));
  if (!storeRef.current) {
    storeRef.current = createGrillaMesNodoStore();
  }
  const store = storeRef.current;

  const gdt = normalizeGdtId(grupoTrabajoId);
  const periodo = String(periodoYm || "").trim().slice(0, 7);

  const cellListenersRef = useRef(/** @type {Map<string, Set<() => void>>} */ (new Map()));
  const snapshotCacheRef = useRef(
    /** @type {Map<string, { revision: number; snapshot: CeldaRenderSnapshot }>} */ (new Map()),
  );
  const [bumpEpoch, setBumpEpoch] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return store.subscribe((keys) => {
      const filtered = new Set();
      for (const k of keys) {
        if (keyPerteneceContexto(k, gdt, periodo)) filtered.add(k);
      }
      if (!filtered.size) return;
      for (const k of filtered) snapshotCacheRef.current.delete(k);
      for (const k of filtered) {
        const set = cellListenersRef.current.get(k);
        if (set) for (const fn of set) fn();
      }
      setBumpEpoch((n) => n + 1);
    });
  }, [store, enabled, gdt, periodo]);

  useEffect(() => {
    if (!enabled || !vistaListado || !gdt) return;
    const payload = vistaListado.grupo_trabajo_id
      ? vistaListado
      : { ...vistaListado, grupo_trabajo_id: gdt };
    store.hidratarDesdeListadoVista(payload);
    snapshotCacheRef.current.clear();
    setBumpEpoch((n) => n + 1);
  }, [store, enabled, gdt, vistaListado]);

  const getCellRenderSnapshot = useCallback(
    (cellKey) => {
      const key = String(cellKey || "").trim();
      const view = store.getCelda(key);
      const rev = view.revision;
      const cached = snapshotCacheRef.current.get(key);
      if (cached && cached.revision === rev) return cached.snapshot;

      const baseCell = view.base && typeof view.base === "object" ? view.base : {};
      const cell = store.getCeldaMerged(key) ?? baseCell;

      const snapshot = {
        revision: rev,
        cell,
        pending: view.pending,
      };
      snapshotCacheRef.current.set(key, { revision: rev, snapshot });
      return snapshot;
    },
    [store],
  );

  const subscribeCell = useCallback((cellKey, listener) => {
    const key = String(cellKey || "").trim();
    let set = cellListenersRef.current.get(key);
    if (!set) {
      set = new Set();
      cellListenersRef.current.set(key, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (!set.size) cellListenersRef.current.delete(key);
    };
  }, []);

  const confirmarBatch = useCallback(
    (...args) => {
      store.confirmarBatch(...args);
      snapshotCacheRef.current.clear();
      setBumpEpoch((n) => n + 1);
    },
    [store],
  );

  const confirmarBatchTrasExito = useCallback(
    async (opsAplicadas, batchResult) => {
      const list = Array.isArray(opsAplicadas) ? opsAplicadas : [];
      const opIds = list.map((o) => String(o?.id || "").trim()).filter(Boolean);
      let parches = parchesVisDesdeRespuestaBatch(batchResult);
      try {
        const desdeAgente = await fetchParchesVisDesdeOpsOutbox(
          list,
          callObtenerVistaGrillaMesAgente,
        );
        parches = mergeParchesVisLista(parches, desdeAgente);
      } catch {
        if (!parches.length) {
          try {
            parches = await fetchParchesVisDesdeOpsOutbox(
              list,
              callObtenerVistaGrillaMesAgente,
            );
          } catch {
            parches = [];
          }
        }
      }
      store.confirmarBatch(
        opIds,
        parches.map((p) => ({
          persona_id: p.persona_id,
          fecha_ymd: p.fecha_ymd,
          gdt: p.gdt,
          celda: p.celda,
        })),
      );
      snapshotCacheRef.current.clear();
      setBumpEpoch((n) => n + 1);
      return parches;
    },
    [store],
  );

  const api = useMemo(
    () =>
      /** @type {GrillaMesNodosApi} */ ({
        store,
        getCellRenderSnapshot,
        subscribeCell,
        confirmarBatch,
        confirmarBatchTrasExito,
        bumpEpoch,
      }),
    [store, getCellRenderSnapshot, subscribeCell, confirmarBatch, confirmarBatchTrasExito, bumpEpoch],
  );

  return api;
}

export function GrillaMesNodosProvider({ value, children }) {
  return createElement(GrillaMesNodosContext.Provider, { value }, children);
}

export function useGrillaMesNodosContext() {
  return useContext(GrillaMesNodosContext);
}

/**
 * Suscripción por celda: re-render solo si cambia el snapshot del nodo.
 * @param {string} cellKey
 */
export function useGrillaMesCeldaSnapshot(cellKey) {
  const api = useGrillaMesNodosContext();
  const key = String(cellKey || "").trim();

  const subscribe = useCallback(
    (listener) => {
      if (!api) return () => {};
      return api.subscribeCell(key, listener);
    },
    [api, key],
  );

  const getSnapshot = useCallback(() => {
    if (!api) {
      return {
        revision: 0,
        cell: {},
        pending: false,
        outboxVisual: null,
      };
    }
    return api.getCellRenderSnapshot(key);
  }, [api, key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { buildCellKey };
