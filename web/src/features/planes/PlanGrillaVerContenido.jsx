import PlanGrillaAprobadaTable from "./PlanGrillaAprobadaTable.jsx";
import "./planGrillaPrint.css";

function formatFechaExport() {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date());
  } catch {
    return new Date().toLocaleString("es-AR");
  }
}

/**
 * @param {{
 *   planId?: string,
 *   grupoLabel?: string,
 *   periodo?: string,
 *   estado?: string,
 *   comentariosJefe?: string|null,
 *   esPreliminar?: boolean,
 *   grillaAprobada: object|null,
 *   labelsPorPersona?: Record<string, { nombre?: string, dni?: string }>,
 *   turnoEtiquetas?: Record<string, string>,
 *   mostrarImprimir?: boolean,
 * }} props
 */
export default function PlanGrillaVerContenido({
  planId,
  grupoLabel,
  periodo,
  estado,
  comentariosJefe,
  esPreliminar = false,
  grillaAprobada,
  labelsPorPersona = {},
  turnoEtiquetas = {},
  mostrarImprimir = true,
}) {
  const handleImprimir = () => {
    window.print();
  };

  const comentarios = String(comentariosJefe || "").trim();

  return (
    <div className="plan-grilla-print-surface space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="text-sm text-slate-800">
          <p className="text-base font-semibold text-slate-900">Turno mensual</p>
          <p className="text-xs text-slate-600">
            {planId ? <span className="font-mono">{planId}</span> : null}
            {planId ? " · " : ""}
            {grupoLabel || "—"} · {periodo || "—"}
            {estado ? ` · ${estado}` : ""}
          </p>
          {esPreliminar && (
            <p className="mt-1 text-[11px] font-medium text-amber-800">Vista preliminar (no histórico inmutable).</p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">Exportado: {formatFechaExport()}</p>
          {comentarios ? (
            <p className="mt-2 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              <span className="font-semibold">Comentarios del jefe:</span> {comentarios}
            </p>
          ) : null}
        </div>
        {mostrarImprimir ? (
          <button
            type="button"
            onClick={handleImprimir}
            className="plan-grilla-no-print min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Imprimir / Exportar
          </button>
        ) : null}
      </div>
      <PlanGrillaAprobadaTable
        grillaAprobada={grillaAprobada}
        labelsPorPersona={labelsPorPersona}
        turnoEtiquetas={turnoEtiquetas}
      />
    </div>
  );
}
