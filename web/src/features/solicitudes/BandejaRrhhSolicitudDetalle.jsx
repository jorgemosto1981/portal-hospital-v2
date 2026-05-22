import {
  metaComplementariaBandeja,
  tituloSolicitudBandeja,
} from "./bandejaSolicitudesFormat.js";

/**
 * Panel de acción / detalle dentro del ítem expandido (bandeja RRHH).
 */
export default function BandejaRrhhSolicitudDetalle({ sel, motivo, setMotivo, procesando, onDecidir, onTomaConocimiento }) {
  if (!sel) return null;

  return (
    <div className="border-t border-violet-100 bg-violet-50/30 px-4 py-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-800">{tituloSolicitudBandeja(sel)}</p>
        <p className="mt-1 text-sm italic text-slate-500">({metaComplementariaBandeja(sel)})</p>
        {sel.titular_dni ? (
          <p className="mt-1 text-xs text-slate-600">
            DNI {sel.titular_dni} · {sel.titular_label}
          </p>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Motivo (opcional)</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          placeholder="Observación para auditoría"
        />
      </label>

      {sel.puede_aprobar_rechazar === true ? (
        <>
          {sel.bandeja_rrhh_modo === "legacy_rrhh" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Trámite en flujo <strong>legacy</strong> (pendiente RRHH sustantivo).
            </p>
          ) : sel.bandeja_rrhh_modo === "cierre_sustituta" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Huérfana: RRHH actúa como <strong>cierre sustituto</strong>.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => onDecidir("aprobar")}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {sel.bandeja_rrhh_modo === "legacy_rrhh" ? "Aprobar (legacy RRHH)" : "Aprobar (cierre sustituto)"}
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
        </>
      ) : sel.puede_registrar_toma_conocimiento === true ? (
        <>
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            El jefe ya cerró la solicitud. RRHH registra acuse de conocimiento.
          </p>
          <button
            type="button"
            disabled={procesando}
            onClick={onTomaConocimiento}
            className="min-h-11 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
          >
            Registrar toma de conocimiento
          </button>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {sel.bandeja_rrhh_modo === "visibilidad_jefe"
            ? "En espera de jefatura; RRHH no cierra este trámite salvo huérfana sustituta."
            : sel.bandeja_rrhh_modo === "toma_conocimiento_ok"
              ? "La toma de conocimiento ya fue registrada."
              : "Solo consulta en este estado."}
        </p>
      )}
    </div>
  );
}
