import Card from "../../../components/ui/Card.jsx";

import { formatDdMmAaaa } from "./dateIso.js";

export function AntiguedadCalculoFormCard({
  personaWrapRef,
  load,
  personaOpen,
  personaQuery,
  personaSeleccionadaLabel,
  setPersonaOpen,
  setPersonaQuery,
  setPersonaId,
  personaOptionsFiltradas,
  usaFechaEspecifica,
  setUsaFechaEspecifica,
  fechaCorte,
  setFechaCorte,
  fechaCorteEfectivaIso,
  resultado,
  personaId,
  busyCalculo,
  onCalcular,
}) {
  return (
    <Card className="print:hidden px-4 py-4 md:px-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div ref={personaWrapRef} className="relative text-sm text-slate-700">
          <label className="block text-xs font-semibold tracking-wide text-slate-600">
            <span className="uppercase">PERSONA</span>
            <span className="field-id ml-1 text-[11px] text-slate-500">(persona_id)</span>
          </label>
          <input
            value={personaOpen ? personaQuery : personaSeleccionadaLabel}
            onFocus={() => {
              setPersonaOpen(true);
              setPersonaQuery("");
            }}
            onChange={(e) => {
              setPersonaOpen(true);
              setPersonaQuery(e.target.value);
            }}
            placeholder="Buscar por nombre, apellido, DNI o ID..."
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
            disabled={load}
          />
          {personaOpen && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setPersonaId("");
                  setPersonaQuery("");
                  setPersonaOpen(false);
                }}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
              >
                Seleccionar persona...
              </button>
              {personaOptionsFiltradas.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>
              ) : (
                personaOptionsFiltradas.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setPersonaId(o.value);
                      setPersonaQuery("");
                      setPersonaOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
                  >
                    <span className="block">{o.label}</span>
                    {o.secondary ? <span className="block text-xs italic text-slate-500">({o.secondary})</span> : null}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={usaFechaEspecifica}
              onChange={(e) => setUsaFechaEspecifica(e.target.checked)}
            />
            Cambiar fecha de cálculo (por defecto hoy)
          </label>
          <label className="mt-2 block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Fecha de corte</span>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              disabled={!usaFechaEspecifica}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">Fecha efectiva: {formatDdMmAaaa(fechaCorteEfectivaIso)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCalcular}
          disabled={busyCalculo || load || !personaId}
          className="min-h-11 touch-manipulation rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {busyCalculo ? "Calculando..." : "Calcular antigüedad"}
        </button>
      </div>
      {!resultado && personaId && !busyCalculo ? (
        <p className="mt-3 text-xs text-slate-500">
          El resultado no se actualiza solo: usá <span className="font-medium text-slate-700">Calcular antigüedad</span>{" "}
          para ver el desglose (HLC, crédito externo si aplica y total).
        </p>
      ) : null}
    </Card>
  );
}
