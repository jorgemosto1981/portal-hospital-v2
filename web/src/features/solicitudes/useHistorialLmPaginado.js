import { useCallback, useState } from "react";

import { callObtenerHistorialLmTitularBandejaAuditor } from "../../services/callables.js";

export const HISTORIAL_LM_PAGE_SIZE_COLLAPSE = 5;
export const HISTORIAL_LM_PAGE_SIZE_MODAL = 20;

/**
 * Paginación historial LM titular (callable bandeja auditor).
 * @param {{ titularPersonaId: string, solicitudIdExcluir?: string, pageSize?: number }} opts
 */
export function useHistorialLmPaginado({
  titularPersonaId,
  solicitudIdExcluir = "",
  pageSize = HISTORIAL_LM_PAGE_SIZE_MODAL,
} = {}) {
  const titular = String(titularPersonaId || "").trim();
  const excluir = String(solicitudIdExcluir || "").trim();

  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [totalFiltrado, setTotalFiltrado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMas, setLoadingMas] = useState(false);
  const [error, setError] = useState("");

  const aplicarRespuesta = useCallback((data, append) => {
    const batch = Array.isArray(data?.items) ? data.items : [];
    setItems((prev) => (append ? [...prev, ...batch] : batch));
    setHasMore(data?.has_more === true);
    setNextCursor(typeof data?.next_cursor === "string" ? data.next_cursor : null);
    setTotalFiltrado(typeof data?.total_filtrado === "number" ? data.total_filtrado : null);
  }, []);

  const fetchPage = useCallback(
    async ({ append = false, cursor = null } = {}) => {
      if (!/^per_/i.test(titular)) return;
      const body = {
        titular_persona_id: titular,
        excluir_solicitud_id: excluir || undefined,
        page_size: pageSize,
        cursor: cursor || undefined,
      };
      const res = await callObtenerHistorialLmTitularBandejaAuditor(body);
      const data = res?.data && typeof res.data === "object" ? res.data : {};
      aplicarRespuesta(data, append);
    },
    [aplicarRespuesta, excluir, pageSize, titular],
  );

  const cargarInicial = useCallback(async () => {
    if (!/^per_/i.test(titular)) return;
    setLoading(true);
    setError("");
    setNextCursor(null);
    try {
      await fetchPage({ append: false });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "No se pudo cargar el historial.";
      setError(msg);
      setItems([]);
      setHasMore(false);
      setTotalFiltrado(null);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, titular]);

  const cargarMas = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMas || loading) return;
    setLoadingMas(true);
    setError("");
    try {
      await fetchPage({ append: true, cursor: nextCursor });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "No se pudo cargar más eventos.";
      setError(msg);
    } finally {
      setLoadingMas(false);
    }
  }, [fetchPage, hasMore, loading, loadingMas, nextCursor]);

  const reset = useCallback(() => {
    setItems([]);
    setHasMore(false);
    setNextCursor(null);
    setTotalFiltrado(null);
    setError("");
    setLoading(false);
    setLoadingMas(false);
  }, []);

  return {
    items,
    hasMore,
    nextCursor,
    totalFiltrado,
    loading,
    loadingMas,
    error,
    cargarInicial,
    cargarMas,
    reset,
  };
}
