import DataOperationFeedback from "../../../components/ui/DataOperationFeedback.jsx";

const inputClass =
  "min-h-11 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 active:border-slate-300";
const labelClass = "flex flex-col gap-1.5 text-base font-medium text-slate-600";
const btnClass =
  "min-h-11 min-w-11 touch-manipulation rounded-lg border border-slate-300 bg-white px-4 text-base font-medium text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-0 sm:px-5";

export function DevCallablesPanel({
  callableOp,
  callableMsg,
  callableBusy,
  rrhh,
  reg,
  onHealth,
  onSync,
  onRrhh,
  onPasoB,
  hasUser,
}) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:mt-5 sm:p-5">
      <h2 className="mb-1 text-xl font-semibold text-slate-800">Desarrollo — callables</h2>
      <p className="mb-3 text-base leading-relaxed text-slate-600">
        Emulador: <code className="text-sm">.env.v2.local</code> → <code className="text-sm">VITE_V2_USE_FUNCTIONS_EMULATOR=true</code> y{" "}
        <code className="text-sm">npm run firebase:emulators:with-functions</code>
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

      <hr className="my-4 border-slate-200" />
      <h3 className="mb-1 text-xl font-semibold text-slate-800">Paso A — rrhhAltaAgente</h3>
      <p className="mb-2 text-base leading-relaxed text-slate-600">Sesión con claim {`portal_role: "rrhh"`}.</p>
      <div className="mb-2 space-y-3">
        <label className={labelClass}>
          DNI
          <input
            className={inputClass}
            value={rrhh.dni}
            onChange={(e) => rrhh.setDni(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className={labelClass}>
          Nombre
          <input className={inputClass} value={rrhh.nom} onChange={(e) => rrhh.setNom(e.target.value)} />
        </label>
        <label className={labelClass}>
          Apellido
          <input className={inputClass} value={rrhh.ape} onChange={(e) => rrhh.setApe(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        className={btnClass}
        disabled={callableBusy || !hasUser}
        onClick={onRrhh}
        title="Requiere claim rrhh"
      >
        rrhhAltaAgente
      </button>

      <hr className="my-4 border-slate-200" />
      <h3 className="mb-1 text-xl font-semibold text-slate-800">Paso B — registrarPrimerAcceso</h3>
      <p className="mb-2 text-base text-slate-600">Cuenta con estado <code className="text-sm">cfg_eca_pend_reg</code>.</p>
      <div className="mb-2 space-y-3">
        <label className={labelClass}>
          DNI
          <input
            className={inputClass}
            value={reg.dni}
            onChange={(e) => reg.setDni(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className={labelClass}>
          Email
          <input
            className={inputClass}
            type="email"
            value={reg.email}
            onChange={(e) => reg.setEmail(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          PIN (6 dígitos)
          <input
            className={inputClass}
            value={reg.pin}
            onChange={(e) => reg.setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
          />
        </label>
      </div>
      <button
        type="button"
        className={btnClass}
        disabled={callableBusy || !reg.dni || !reg.email || reg.pin.length !== 6}
        onClick={onPasoB}
      >
        registrarPrimerAcceso
      </button>
    </section>
  );
}
