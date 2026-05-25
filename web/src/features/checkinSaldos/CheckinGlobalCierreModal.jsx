export function CheckinGlobalCierreModal({
  open,
  step,
  lineas,
  advertencias,
  acks,
  onToggleAck,
  todosAckMarcados,
  enviando,
  onCerrar,
  onContinuar,
  onConfirmarFinal,
}) {
  if (!open) return null;

  const tieneDatos = lineas.some((l) => l.tipo !== "meta");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-global-modal-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id="checkin-global-modal-title" className="text-lg font-semibold text-slate-900">
          {step === 1 ? "Resumen del check-in" : step === 2 ? "Advertencias" : "Confirmación final"}
        </h2>
        {step === 1 ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Solo se listan los valores que cargaste en esta sesión. Los artículos sin datos no aparecen.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-800">
              {lineas.map((l, i) => (
                <li
                  key={`${l.tipo}-${i}`}
                  className={l.tipo === "meta" ? "text-slate-500" : "rounded-lg bg-slate-50 px-3 py-2"}
                >
                  {l.texto}
                </li>
              ))}
            </ul>
            {!tieneDatos ? (
              <p className="mt-3 text-sm text-amber-800">
                No hay saldos informados en el formulario. En el siguiente paso podés revisar advertencias antes de
                cerrar.
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={onContinuar}
                className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white touch-manipulation active:bg-blue-700"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 touch-manipulation active:bg-slate-100"
              >
                Volver
              </button>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Revisá cada punto. El cierre global no exige todas las bolsas, pero debés confirmar que entendés el alcance.
            </p>
            <ul className="mt-4 space-y-3">
              {advertencias.map((a) => (
                <li key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-amber-950">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-amber-400"
                      checked={Boolean(acks[a.id])}
                      onChange={() => onToggleAck(a.id)}
                    />
                    <span>{a.texto}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={!todosAckMarcados}
                onClick={onContinuar}
                className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 touch-manipulation active:bg-blue-700"
              >
                Continuar al cierre
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 touch-manipulation active:bg-slate-100"
              >
                Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Esta acción cierra el check-in global del agente. No podrá guardar más saldos hasta autorizar recarga.
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
              {lineas.filter((l) => l.tipo !== "meta").map((l, i) => (
                <li key={i}>{l.texto}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={enviando}
                onClick={onConfirmarFinal}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50 touch-manipulation active:bg-red-700"
              >
                {enviando ? "Cerrando…" : "Sí, cerrar check-in global"}
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={onCerrar}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 touch-manipulation active:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
