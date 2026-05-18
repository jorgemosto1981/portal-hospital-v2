import { listAniosCheckinPermitidos } from "./checkinFilasUtils.js";

export function CheckinLaoFilasEditor({ anioA, filas, onAgregarFila, onQuitarFila, onCambiarFila }) {
  const aniosPermitidos = anioA != null ? listAniosCheckinPermitidos(anioA) : [];
  const filasHabilitadas = anioA != null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          {filasHabilitadas ? `Saldos históricos (año < ${anioA})` : "Saldos históricos"}
        </h2>
        <button
          type="button"
          onClick={onAgregarFila}
          disabled={!filasHabilitadas}
          className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
        >
          + Año
        </button>
      </div>

      <ul className="space-y-3">
        {filas.map((fila, idx) => (
          <li key={fila.key} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Fila {idx + 1}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="text-xs font-medium text-slate-600">Año origen</span>
                <select
                  value={fila.anio_origen === "" ? "" : String(fila.anio_origen)}
                  onChange={(e) => onCambiarFila(fila.key, { anio_origen: e.target.value })}
                  disabled={!filasHabilitadas}
                  className="min-h-11 w-full touch-manipulation rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 disabled:bg-slate-100"
                >
                  <option value="">Elegir año…</option>
                  {aniosPermitidos.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span className="text-xs font-medium text-slate-600">Días disponibles</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={fila.dias_disponibles}
                  onChange={(e) => onCambiarFila(fila.key, { dias_disponibles: e.target.value })}
                  placeholder="0"
                  className="min-h-11 w-full touch-manipulation rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </label>
              <div className="flex items-end sm:justify-end">
                <button
                  type="button"
                  disabled={filas.length <= 1}
                  onClick={() => onQuitarFila(fila.key)}
                  className="min-h-11 w-full touch-manipulation rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-800 active:bg-red-50 disabled:opacity-40 sm:w-auto"
                >
                  Quitar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!filasHabilitadas ? (
        <p className="text-xs text-slate-500">Elegí primero el año de corte A para habilitar las filas de saldo.</p>
      ) : null}
    </div>
  );
}
