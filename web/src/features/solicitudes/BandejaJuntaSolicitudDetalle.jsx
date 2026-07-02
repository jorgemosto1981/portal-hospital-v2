import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";

export default function BandejaJuntaSolicitudDetalle({
  sel,
  observacion,
  setObservacion,
  procesando,
  onDictaminar,
}) {
  if (!sel) return null;

  return (
    <div className="space-y-4 border-t border-violet-100 bg-violet-50/30 px-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle — derivación a junta</p>
        <div className="mt-2">
          <BandejaSolicitudExpandDatos sel={sel} variant="junta" />
        </div>
      </div>

      {sel.puede_dictaminar === true ? (
        <>
          <p className="text-sm text-slate-600">
            El auditor derivó este tramo (&gt;15 días o regla institucional). Registrá el dictamen de junta; favorable
            consolida licencia y tramos de haberes en grilla.
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Observación de junta (opcional)</span>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              placeholder="Resolución o notas del acta"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDictaminar(true)}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Dictamen favorable
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDictaminar(false)}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Dictamen desfavorable
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          No hay dictamen disponible: falta clasificación del auditor o el trámite ya fue resuelto.
        </p>
      )}
    </div>
  );
}
