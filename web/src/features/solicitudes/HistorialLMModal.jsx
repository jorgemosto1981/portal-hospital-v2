import { useEffect } from "react";

import HistorialLMFila from "./HistorialLMFila.jsx";
import {
  HISTORIAL_LM_PAGE_SIZE_MODAL,
  useHistorialLmPaginado,
} from "./useHistorialLmPaginado.js";

/**
 * Modal — historial LM completo del titular (paginado).
 * @param {{
 *   abierto: boolean,
 *   onCerrar: () => void,
 *   titularPersonaId?: string | null,
 *   solicitudIdExcluir?: string | null,
 *   titularLabel?: string | null,
 * }} props
 */
export default function HistorialLMModal({
  abierto = false,
  onCerrar,
  titularPersonaId = null,
  solicitudIdExcluir = null,
  titularLabel = null,
}) {
  const titular = String(titularPersonaId || "").trim();
  const {
    items,
    hasMore,
    totalFiltrado,
    loading,
    loadingMas,
    error,
    cargarInicial,
    cargarMas,
    reset,
  } = useHistorialLmPaginado({
    titularPersonaId: titular,
    solicitudIdExcluir: String(solicitudIdExcluir || ""),
    pageSize: HISTORIAL_LM_PAGE_SIZE_MODAL,
  });

  useEffect(() => {
    if (!abierto) {
      reset();
      return;
    }
    void cargarInicial();
  }, [abierto, cargarInicial, reset]);

  if (!abierto || !/^per_/i.test(titular)) return null;

  const nombre = String(titularLabel || "").trim();
  const restantes =
    totalFiltrado != null && items.length < totalFiltrado ? totalFiltrado - items.length : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historial-lm-modal-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="historial-lm-modal-titulo" className="text-lg font-semibold text-slate-900">
              Historial de licencias médicas
            </h2>
            {nombre ? <p className="mt-1 truncate text-sm text-slate-600">{nombre}</p> : null}
            {totalFiltrado != null ? (
              <p className="mt-1 text-xs text-slate-500">
                {items.length} de {totalFiltrado} evento{totalFiltrado === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-11 min-w-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
            aria-label="Cerrar historial"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && items.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loading && error ? <p className="text-sm text-rose-700">{error}</p> : null}

          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin solicitudes previas con dictamen o derivación a junta para este titular.
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="space-y-2">
              {items.map((row) => (
                <HistorialLMFila key={String(row.solicitud_id)} row={row} />
              ))}
            </ul>
          ) : null}

          {hasMore ? (
            <button
              type="button"
              disabled={loadingMas || loading}
              onClick={() => void cargarMas()}
              className="min-h-11 w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 active:bg-sky-100 disabled:opacity-50"
            >
              {loadingMas
                ? "Cargando…"
                : restantes != null && restantes > 0
                  ? `Cargar más (${restantes} restante${restantes === 1 ? "" : "s"})`
                  : "Cargar más eventos"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
