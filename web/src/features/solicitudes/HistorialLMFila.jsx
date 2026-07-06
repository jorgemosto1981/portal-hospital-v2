import {
  clasesBadgeEstadoHistorialLm,
  etiquetaArticuloHistorialLm,
  textoRangoHistorialLm,
} from "./historialLmBandejaAuditorUi.js";

/**
 * Fila timeline — historial LM bandeja auditor.
 * @param {{ row: Record<string, unknown> }} props
 */
export default function HistorialLMFila({ row }) {
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
