import { useCallback, useMemo, useState } from "react";

import PlanGrillaVistaModal from "../../../features/planes/PlanGrillaVistaModal.jsx";

const BADGE_ESTADO = {
  ENVIADO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-amber-100 text-amber-800",
};
const LABEL_ESTADO = {
  ENVIADO: "Enviado",
  EN_REVISION: "En revisión",
};

function tituloPlan(plan) {
  const periodo = plan?.periodo ? `Período: ${plan.periodo}` : "Período: —";
  const grupo = plan?.grupo_label || plan?.grupo_id || "—";
  return `${periodo} — Grupo: ${grupo}`;
}

function ModalRechazo({ planId, onConfirm, onCancel }) {
  const [obs, setObs] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Rechazar plan</h3>
        <p className="mb-3 text-sm text-slate-600">
          Plan: <span className="font-mono text-xs">{planId}</span>
        </p>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Observaciones de rechazo (obligatorio)
        </label>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          placeholder="Motivo del rechazo…"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{obs.length}/500</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!obs.trim()}
            onClick={() => onConfirm(obs.trim())}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
          >
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BandejaAprobaciones({ planes, onTransicion, operando, esRrhh, mostrarGrupo }) {
  const [rechazoModal, setRechazoModal] = useState(null);
  const [planVer, setPlanVer] = useState(null);

  const labelsExtra = useMemo(() => {
    if (!planVer) return {};
    const out = {};
    for (const ag of planVer.agentes || []) {
      if (!ag.persona_id) continue;
      out[ag.persona_id] = {
        nombre: ag.persona_label || ag.nombre || ag.nombre_completo,
        dni: ag.persona_dni || ag.dni,
      };
    }
    return out;
  }, [planVer]);

  const handleRechazar = useCallback((planId) => {
    setRechazoModal(planId);
  }, []);

  const confirmRechazo = useCallback((obs) => {
    onTransicion("rechazar", rechazoModal, { observaciones: obs });
    setRechazoModal(null);
  }, [rechazoModal, onTransicion]);

  if (planes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-12 text-center shadow-sm">
        <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-3 text-sm text-slate-500">No hay planes pendientes de aprobación.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{planes.length} plan(es) pendiente(s) de revisión.</p>
      {planes.map((plan) => (
        <div key={plan.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{tituloPlan(plan)}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_ESTADO[plan.estado] || "bg-slate-100"}`}>
                  {LABEL_ESTADO[plan.estado] || plan.estado}
                </span>
                {plan.aprobacion_pendiente?.huerfano && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                    Huérfano — RRHH
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-slate-400">{plan.id}</p>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Tipo:</span> {plan.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}
                {plan.periodo && <> — <span className="font-medium">Período:</span> {plan.periodo}</>}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium">Agentes:</span> {plan.agentes?.length || 0}
                {" — "}
                <span className="font-medium">Grupo:</span> {mostrarGrupo ? (plan.grupo_label || plan.grupo_id) : plan.grupo_id}
              </p>
              {plan.observaciones_rechazo && (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  Rechazo previo: {plan.observaciones_rechazo}
                </div>
              )}
              {plan.observaciones_revision && plan.estado === "EN_REVISION" && (
                <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                  Motivo de revisión: {plan.observaciones_revision}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-wrap gap-2">
              {plan.tipo_plan === "mensual" && (
                <button
                  type="button"
                  onClick={() => setPlanVer(plan)}
                  className="min-h-11 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 shadow-sm transition hover:bg-indigo-100"
                >
                  Ver turno
                </button>
              )}
              {(plan.estado === "ENVIADO" || plan.estado === "EN_REVISION") && (
                <button
                  type="button"
                  disabled={operando}
                  onClick={() => onTransicion("aprobar", plan.id)}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  {plan.estado === "EN_REVISION" ? "Rehabilitar" : "Aprobar"}
                </button>
              )}
              {(plan.estado === "ENVIADO" || plan.estado === "EN_REVISION") && (
                <button
                  type="button"
                  disabled={operando}
                  onClick={() => handleRechazar(plan.id)}
                  className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
                >
                  Rechazar
                </button>
              )}
            </div>
          </div>

        </div>
      ))}

      {planVer && (
        <PlanGrillaVistaModal plan={planVer} labelsExtra={labelsExtra} onClose={() => setPlanVer(null)} />
      )}

      {rechazoModal && (
        <ModalRechazo planId={rechazoModal} onConfirm={confirmRechazo} onCancel={() => setRechazoModal(null)} />
      )}
    </div>
  );
}
