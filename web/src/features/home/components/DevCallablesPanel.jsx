import DataOperationFeedback from "../../../components/ui/DataOperationFeedback.jsx";

const btnClass =
  "min-h-11 min-w-11 touch-manipulation rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-0 sm:px-5";

export function DevCallablesPanel({
  callableOp,
  callableMsg,
  callableBusy,
  onHealth,
  onSync,
  hasUser,
}) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:mt-5 sm:p-5">
      <h2 className="mb-1 text-xl font-semibold text-slate-800">Desarrollo — callables</h2>
      <p className="mb-3 text-base leading-relaxed text-slate-600">
        Panel técnico de diagnóstico contra <strong>Cloud Functions</strong> desplegadas. El alta RRHH y el primer
        acceso se operan desde sus pantallas oficiales.
      </p>
      {callableOp?.status && callableOp.status !== "idle" ? (
        <div className="mb-4 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <DataOperationFeedback
            status={callableOp.status}
            message={
              callableOp.status === "error"
                ? (callableMsg || callableOp.message)
                : callableOp.message
            }
          />
          {callableOp.status === "success" && callableMsg ? (
            <pre
              className="mt-2 max-h-56 w-full min-w-0 overflow-x-auto overflow-y-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"
              role="status"
            >
              {callableMsg}
            </pre>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnClass} disabled={callableBusy} onClick={onHealth}>
          healthV2
        </button>
        <button type="button" className={btnClass} disabled={callableBusy || !hasUser} onClick={onSync}>
          syncSessionClaims
        </button>
      </div>
    </section>
  );
}
