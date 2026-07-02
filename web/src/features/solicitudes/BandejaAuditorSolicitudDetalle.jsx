import BandejaSolicitudExpandDatos from "./BandejaSolicitudExpandDatos.jsx";

export default function BandejaAuditorSolicitudDetalle({
  sel,
  observacion,
  setObservacion,
  procesando,
  onClasificar,
}) {
  if (!sel) return null;

  const dias = Number(sel.dias_solicitados) || 1;
  const juntaHint = dias > 15;

  return (
    <div className="space-y-4 border-t border-teal-100 bg-teal-50/30 px-4 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle del aviso médico</p>
        <div className="mt-2">
          <BandejaSolicitudExpandDatos sel={sel} variant="auditor" />
        </div>
      </div>

      {sel.es_licencia_incompleta === true ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aviso provisorio: el agente debe completar el certificado antes de clasificar. Usá el filtro
          &quot;Completas&quot; para la cola de auditoría.
        </p>
      ) : null}

      {sel.puede_clasificar === true ? (
        <>
          {juntaHint ? (
            <p className="text-sm text-slate-700">
              Este tramo supera 15 días corridos. Un dictamen <strong>favorable</strong> derivará a junta médica;
              desfavorable rechaza el aviso.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Dictamen favorable aprueba la licencia corta (Art. 14) y consolida en grilla; desfavorable rechaza.
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Observación del auditor (opcional)</span>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              placeholder="Notas de clasificación"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onClasificar(true)}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Dictamen favorable
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onClasificar(false)}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Dictamen desfavorable
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500">Sin acciones de clasificación para este ítem.</p>
      )}
    </div>
  );
}
