import { useCallback, useState } from "react";

import { callObtenerHistorialLmTitularBandejaAuditor } from "../../services/callables.js";
import HistorialLMFila from "./HistorialLMFila.jsx";
import HistorialLMModal from "./HistorialLMModal.jsx";
import { HISTORIAL_LM_PAGE_SIZE_COLLAPSE } from "./useHistorialLmPaginado.js";

/**
 * Acordeón lazy-load — historial reciente LM del titular (bandeja auditoría médica).
 * @param {{
 *   titularPersonaId?: string | null,
 *   solicitudIdExcluir?: string | null,
 *   titularLabel?: string | null,
 * }} props
 */
export default function HistorialLMCollapse({
  titularPersonaId = null,
  solicitudIdExcluir = null,
  titularLabel = null,
}) {
  const titular = String(titularPersonaId || "").trim();
  const excluir = String(solicitudIdExcluir || "").trim();
  const puedeCargar = /^per_/i.test(titular);

  const [historial, setHistorial] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalFiltrado, setTotalFiltrado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!puedeCargar || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await callObtenerHistorialLmTitularBandejaAuditor({
        titular_persona_id: titular,
        excluir_solicitud_id: excluir || undefined,
        page_size: HISTORIAL_LM_PAGE_SIZE_COLLAPSE,
      });
      const data = res?.data && typeof res.data === "object" ? res.data : {};
      const items = Array.isArray(data.items) ? data.items : [];
      setHistorial(items);
      setHasMore(data.has_more === true);
      setTotalFiltrado(typeof data.total_filtrado === "number" ? data.total_filtrado : null);
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "No se pudo cargar el historial.";
      setError(msg);
      setHistorial([]);
      setHasMore(false);
      setTotalFiltrado(null);
    } finally {
      setLoading(false);
    }
  }, [excluir, loading, puedeCargar, titular]);

  const handleToggle = (event) => {
    if (!event.currentTarget.open) return;
    if (historial !== null || loading) return;
    void cargar();
  };

  if (!puedeCargar) return null;

  const restantes =
    totalFiltrado != null && historial?.length != null ? Math.max(0, totalFiltrado - historial.length) : null;

  return (
    <>
      <details className="rounded-lg border border-slate-200 bg-white" onToggle={handleToggle}>
        <summary className="flex min-h-[44px] cursor-pointer touch-manipulation list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span>Historial reciente de licencias médicas</span>
          {historial?.length ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium tabular-nums text-slate-600">
              {historial.length}
              {totalFiltrado != null && totalFiltrado > historial.length ? ` / ${totalFiltrado}` : ""}
            </span>
          ) : null}
        </summary>

        <div className="space-y-2 border-t border-slate-200 px-3 py-2">
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-live="polite">
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loading && error ? <p className="text-xs text-rose-700">{error}</p> : null}

          {!loading && !error && historial && historial.length === 0 ? (
            <p className="text-xs text-slate-500">
              Sin solicitudes previas con dictamen o derivación a junta para este titular.
            </p>
          ) : null}

          {!loading && historial?.length ? (
            <ul className="space-y-2">
              {historial.map((row) => (
                <HistorialLMFila key={String(row.solicitud_id)} row={row} />
              ))}
            </ul>
          ) : null}

          {!loading && hasMore ? (
            <button
              type="button"
              className="min-h-[44px] w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-semibold text-sky-900 active:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              onClick={() => setModalAbierto(true)}
            >
              {restantes != null && restantes > 0
                ? `Ver historial completo (${restantes} evento${restantes === 1 ? "" : "s"} más)`
                : "Ver historial completo"}
            </button>
          ) : null}
        </div>
      </details>

      <HistorialLMModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titularPersonaId={titular}
        solicitudIdExcluir={excluir}
        titularLabel={titularLabel}
      />
    </>
  );
}
