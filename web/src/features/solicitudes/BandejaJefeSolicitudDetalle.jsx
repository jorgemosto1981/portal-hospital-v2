import {
  metaComplementariaBandeja,
  tituloSolicitudBandeja,
} from "./bandejaSolicitudesFormat.js";

export default function BandejaJefeSolicitudDetalle({ sel, motivo, setMotivo, procesando, onDecidir }) {
  if (!sel) return null;

  return (
    <div className="space-y-4 border-t border-blue-100 bg-blue-50/30 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{tituloSolicitudBandeja(sel)}</p>
        <p className="mt-1 text-sm italic text-slate-500">({metaComplementariaBandeja(sel)})</p>
        {sel.titular_dni ? (
          <p className="mt-1 text-xs text-slate-600">
            {sel.titular_label} · DNI {sel.titular_dni}
          </p>
        ) : null}
      </div>

      {sel.puede_decidir === true ? (
        <>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Motivo (opcional)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Observación para auditoría"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir("aprobar")}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Aprobar (cierre jerárquico)
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir("rechazar")}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Al aprobar, la solicitud queda aprobada; RRHH registra toma de conocimiento. Al rechazar, se anula y
            se devuelve el saldo Patrón B si correspondía.
          </p>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {sel.etiqueta_estado || "Solo consulta: ya no podés decidir sobre este trámite."}
        </p>
      )}
    </div>
  );
}
