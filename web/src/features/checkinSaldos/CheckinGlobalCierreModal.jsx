export function CheckinGlobalCierreModal({
  open,
  step,
  lineas,
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
          {step === 1 ? "Resumen del check-in" : "Confirmación final"}
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
                No hay saldos informados en el formulario. Podés cerrar igualmente o volver a cargar datos.
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={onContinuar}
                className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
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
            <ul className="mt-3 max-h-40 overflow-y-auto space-y-1 text-xs text-slate-600">
              {lineas.filter((l) => l.tipo !== "meta").map((l, i) => (
                <li key={i}>{l.texto}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={enviando}
                onClick={onConfirmarFinal}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {enviando ? "Cerrando…" : "Sí, cerrar check-in global"}
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={onCerrar}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700"
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