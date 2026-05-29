import PlanGrillaVerContenido from "./PlanGrillaVerContenido.jsx";
import { useVistaPlanTurno } from "./useVistaPlanTurno.js";

function mergeLabels(base = {}, extra = {}) {
  const out = { ...base };
  for (const [pid, meta] of Object.entries(extra)) {
    if (!meta || typeof meta !== "object") continue;
    const prev = out[pid] || {};
    out[pid] = {
      nombre: meta.nombre != null && meta.nombre !== "" ? meta.nombre : prev.nombre,
      dni: meta.dni != null && meta.dni !== "" ? meta.dni : prev.dni,
    };
  }
  return out;
}

/**
 * Modal unificado: VER turno/plan mensual (lectura SoT en plt_*).
 * @param {{ plan: { id: string, grupo_label?: string, grupo_id?: string, periodo?: string, tipo_plan?: string, estado?: string, comentarios_jefe?: string|null }|null, onClose: () => void, labelsExtra?: Record<string, { nombre?: string, dni?: string }> }} props
 */
export default function PlanGrillaVistaModal({ plan, onClose, labelsExtra = {} }) {
  const planId = plan?.id || null;
  const {
    loading,
    plan: planVista,
    grillaAprobada,
    labelsPorPersona,
    turnoEtiquetas,
    comentariosJefe,
    error,
  } = useVistaPlanTurno(planId, Boolean(planId));

  const headerGrupo = plan?.grupo_label || plan?.grupo_id || planVista?.grupo_label || planVista?.grupo_id || "—";
  const headerPeriodo = plan?.periodo || planVista?.periodo || (plan?.tipo_plan === "perpetuo" ? "Perpetuo" : "—");
  const esHistorico = planVista?.es_snapshot_persistido === true;
  const estado = plan?.estado || planVista?.estado;
  const comentarios =
    comentariosJefe ??
    plan?.comentarios_jefe ??
    planVista?.comentarios_jefe ??
    null;

  if (!planId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-2 md:p-4 print:static print:bg-white print:p-0" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-[98vw] flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="plan-grilla-no-print flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Turno mensual (vista aprobada)</h3>
            <p className="text-xs text-slate-500">
              {planId} · {headerGrupo} · {headerPeriodo}
              {estado ? ` · ${estado}` : ""}
            </p>
            {esHistorico && (
              <p className="mt-1 text-[11px] text-emerald-700">Snapshot histórico inmutable (grilla_aprobada).</p>
            )}
            {!esHistorico && estado === "HABILITADO" && (
              <p className="mt-1 text-[11px] text-amber-700">Vista calculada; snapshot pendiente de persistir.</p>
            )}
            {!esHistorico && estado && estado !== "HABILITADO" && (
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
            <PlanGrillaVerContenido
              planId={planId}
              grupoLabel={headerGrupo}
              periodo={headerPeriodo}
              estado={estado}
              comentariosJefe={comentarios}
              esPreliminar={!esHistorico}
              grillaAprobada={grillaAprobada}
              labelsPorPersona={mergeLabels(labelsExtra, labelsPorPersona)}
              turnoEtiquetas={turnoEtiquetas}
            />
          )}
        </div>
      </div>
    </div>
  );
}
