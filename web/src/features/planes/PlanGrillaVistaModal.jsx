import PlanGrillaAprobadaTable from "./PlanGrillaAprobadaTable.jsx";
import { useVistaPlanTurno } from "./useVistaPlanTurno.js";

function mergeLabels(base = {}, extra = {}) {
  const out = { ...base };
  for (const [pid, meta] of Object.entries(extra)) {
    out[pid] = { ...(out[pid] || {}), ...meta };
  }
  return out;
}

/**
 * Modal unificado: VER turno/plan mensual (lectura SoT en plt_*).
 * @param {{ plan: { id: string, grupo_label?: string, grupo_id?: string, periodo?: string, tipo_plan?: string, estado?: string }|null, onClose: () => void, labelsExtra?: Record<string, { nombre?: string, dni?: string }> }} props
 */
export default function PlanGrillaVistaModal({ plan, onClose, labelsExtra = {} }) {
  const planId = plan?.id || null;
  const { loading, plan: planVista, grillaAprobada, labelsPorPersona, error } = useVistaPlanTurno(planId, Boolean(planId));

  const headerGrupo = plan?.grupo_label || plan?.grupo_id || planVista?.grupo_label || planVista?.grupo_id || "—";
  const headerPeriodo = plan?.periodo || planVista?.periodo || (plan?.tipo_plan === "perpetuo" ? "Perpetuo" : "—");
  const esHistorico = planVista?.es_snapshot_persistido === true;

  if (!planId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Turno mensual (vista aprobada)</h3>
            <p className="text-xs text-slate-500">
              {planId} · {headerGrupo} · {headerPeriodo}
              {planVista?.estado ? ` · ${planVista.estado}` : ""}
            </p>
            {esHistorico && (
              <p className="mt-1 text-[11px] text-emerald-700">Snapshot histórico inmutable (grilla_aprobada).</p>
            )}
            {!esHistorico && planVista?.estado === "HABILITADO" && (
              <p className="mt-1 text-[11px] text-amber-700">Vista calculada; snapshot pendiente de persistir.</p>
            )}
            {!esHistorico && planVista?.estado && planVista.estado !== "HABILITADO" && (
              <p className="mt-1 text-[11px] text-slate-500">Vista de lectura según documento del plan (pre-aprobación).</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </header>
        <div className="flex-1 overflow-auto p-4">
          {plan?.tipo_plan === "perpetuo" || planVista?.tipo_plan === "perpetuo" ? (
            <p className="text-sm text-slate-600">Plan perpetuo: sin grilla mensual día a día.</p>
          ) : loading ? (
            <p className="text-sm text-slate-600">Cargando grilla del plan…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <PlanGrillaAprobadaTable
              conLeyenda
              grillaAprobada={grillaAprobada}
              labelsPorPersona={mergeLabels(labelsExtra, labelsPorPersona)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
