import { useCallback, useState } from "react";

const BADGE_ESTADO = {
  ENVIADO: "bg-blue-100 text-blue-800",
  AUTORIZADO_SUPERIOR: "bg-amber-100 text-amber-800",
};
const LABEL_ESTADO = {
  ENVIADO: "Enviado",
  AUTORIZADO_SUPERIOR: "Autorizado",
};

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

export default function BandejaAprobaciones({ planes, onTransicion, operando }) {
  const [rechazoModal, setRechazoModal] = useState(null);

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
                <span className="font-mono text-xs text-slate-500">{plan.id}</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_ESTADO[plan.estado] || "bg-slate-100"}`}>
                  {LABEL_ESTADO[plan.estado] || plan.estado}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Tipo:</span> {plan.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}
                {plan.periodo && <> — <span className="font-medium">Período:</span> {plan.periodo}</>}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium">Agentes:</span> {plan.agentes?.length || 0}
                {" — "}
                <span className="font-medium">Grupo:</span> {plan.grupo_id}
              </p>
              {plan.observaciones_rechazo && (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                  Rechazo previo: {plan.observaciones_rechazo}
                </div>
              )}
            </div>
            <div className="flex flex-shrink-0 gap-2">
              {plan.estado === "ENVIADO" && (
                <button
                  type="button"
                  disabled={operando}
                  onClick={() => onTransicion("aprobar", plan.id)}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  Aprobar
                </button>
              )}
              {plan.estado === "AUTORIZADO_SUPERIOR" && (
                <button
                  type="button"
                  disabled={operando}
                  onClick={() => onTransicion("habilitar", plan.id)}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  Habilitar
                </button>
              )}
              <button
                type="button"
                disabled={operando}
                onClick={() => handleRechazar(plan.id)}
                className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>

          {/* Mini grilla read-only para mensuales */}
          {plan.tipo_plan === "mensual" && plan.agentes?.length > 0 && plan.agentes[0]?.dias && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
              <table className="min-w-max text-[10px]">
                <thead>
                  <tr>
                    <th className="px-1 py-0.5 text-left text-slate-400">Agente</th>
                    {Object.keys(plan.agentes[0].dias).sort().map((d) => (
                      <th key={d} className="px-0.5 py-0.5 text-center text-slate-400">{d.slice(-2)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.agentes.map((ag) => (
                    <tr key={ag.persona_id}>
                      <td className="whitespace-nowrap px-1 py-0.5 font-mono text-slate-600">{ag.persona_id}</td>
                      {ag.dias && Object.keys(ag.dias).sort().map((d) => {
                        const cel = ag.dias[d];
                        const esFranco = cel.tipo_dia === "franco" || cel.tipo_dia === "no_laborable";
                        const bg = esFranco ? "bg-slate-200 text-slate-500"
                          : cel.turno_id === "M" ? "bg-yellow-100 text-yellow-700"
                          : cel.turno_id === "T" ? "bg-blue-100 text-blue-700"
                          : cel.turno_id === "N" ? "bg-indigo-100 text-indigo-700"
                          : "bg-green-100 text-green-700";
                        return (
                          <td key={d} className={`px-0.5 py-0.5 text-center font-bold ${bg}`}>
                            {esFranco ? "F" : cel.turno_id || "?"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {rechazoModal && (
        <ModalRechazo planId={rechazoModal} onConfirm={confirmRechazo} onCancel={() => setRechazoModal(null)} />
      )}
    </div>
  );
}
