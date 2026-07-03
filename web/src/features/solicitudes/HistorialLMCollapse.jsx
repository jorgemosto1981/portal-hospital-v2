import { useCallback, useState } from "react";

import { callObtenerHistorialLmTitularBandejaAuditor } from "../../services/callables.js";
import {
  clasesBadgeEstadoHistorialLm,
  etiquetaArticuloHistorialLm,
  textoRangoHistorialLm,
} from "./historialLmBandejaAuditorUi.js";

/**
 * @param {{ row: Record<string, unknown> }} props
 */
function FilaHistorialLm({ row }) {
  const estadoLabel = String(row.estado_label || "—");
  const categoria = String(row.estado_categoria || "otro");
  const solId = String(row.solicitud_id || "");

  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${clasesBadgeEstadoHistorialLm(categoria)}`}
        >
          {estadoLabel}
        </span>
        <span className="text-[11px] tabular-nums text-slate-500">{textoRangoHistorialLm(row)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-700">{etiquetaArticuloHistorialLm(row)}</p>
      {solId ? (
        <p className="mt-0.5 truncate text-[10px] text-slate-400" title={solId}>
          {solId}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Acordeón lazy-load — historial reciente LM del titular (bandeja auditoría médica).
 * @param {{ titularPersonaId?: string | null, solicitudIdExcluir?: string | null }} props
 */
export default function HistorialLMCollapse({
  titularPersonaId = null,
  solicitudIdExcluir = null,
}) {
  const titular = String(titularPersonaId || "").trim();
  const excluir = String(solicitudIdExcluir || "").trim();
  const puedeCargar = /^per_/i.test(titular);

  const [historial, setHistorial] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(
    async (ampliado = false) => {
      if (!puedeCargar || loading) return;
      setLoading(true);
      setError("");
      try {
        const res = await callObtenerHistorialLmTitularBandejaAuditor({
          titular_persona_id: titular,
          excluir_solicitud_id: excluir || undefined,
          ampliado,
        });
        const data = res?.data && typeof res.data === "object" ? res.data : {};
        const items = Array.isArray(data.items) ? data.items : [];
        setHistorial(items);
        setHasMore(ampliado ? false : data.has_more === true);
      } catch (err) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "No se pudo cargar el historial.";
        setError(msg);
        setHistorial([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [excluir, loading, puedeCargar, titular],
  );

  const handleToggle = (event) => {
    if (!event.currentTarget.open) return;
    if (historial !== null || loading) return;
    void cargar(false);
  };

  if (!puedeCargar) return null;

  return (
    <details
      className="rounded-lg border border-slate-200 bg-white"
      onToggle={handleToggle}
    >
      <summary className="flex min-h-[44px] cursor-pointer touch-manipulation list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span>Historial reciente de licencias médicas</span>
        {historial?.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium tabular-nums text-slate-600">
            {historial.length}
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
              <FilaHistorialLm key={String(row.solicitud_id)} row={row} />
            ))}
          </ul>
        ) : null}

        {!loading && hasMore ? (
          <button
            type="button"
            className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-sky-800 active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            onClick={() => void cargar(true)}
          >
            Ver historial completo…
          </button>
        ) : null}
      </div>
    </details>
  );
}
