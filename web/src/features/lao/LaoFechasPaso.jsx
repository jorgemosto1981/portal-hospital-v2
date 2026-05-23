import { MODO_COMPUTO_CORRIDOS } from "../../../../shared/utils/modoComputoCalendario.js";
import { TICKETERA } from "../solicitudes/ticketeraUi.js";
import { lineasDiasDescontadosDisplay } from "./laoDisplayUtils.js";

/**
 * Paso 2 — rango de fechas + resumen de cómputo (RFC §5).
 */
export default function LaoFechasPaso({
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  mostrarFechaDesde = true,
  mostrarFechaHasta = true,
  mostrarResumen = true,
  isLoading = false,
  modoComputo = "",
  resumenComputo = null,
  mensajes = [],
  ok = false,
}) {
  const esCorridos = modoComputo === MODO_COMPUTO_CORRIDOS;
  const resumen = resumenComputo;
  const lineasDescontados = lineasDiasDescontadosDisplay(resumen?.dias_descontados);

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      {mostrarFechaDesde ? (
        <label className="block space-y-1">
          <span className={TICKETERA.label}>Fecha de inicio</span>
          <input
            type="date"
            inputMode="numeric"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className={TICKETERA.input}
          />
        </label>
      ) : null}

      {mostrarFechaHasta ? (
        <label className="block space-y-1">
          <span className={TICKETERA.label}>Fecha de fin</span>
          <input
            type="date"
            inputMode="numeric"
            value={fechaHasta}
            min={fechaDesde || undefined}
            onChange={(e) => setFechaHasta(e.target.value)}
            className={TICKETERA.input}
          />
        </label>
      ) : null}

      {isLoading ? (
        <p className={`${TICKETERA.muted} text-xs`} role="status">
          Cargando calendario institucional…
        </p>
      ) : null}

      {mostrarResumen && resumen ? (
        <div
          className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-slate-900">Resumen de cómputo</p>
          {esCorridos ? (
            <p>
              Días totales de calendario:{" "}
              <span className="font-semibold tabular-nums">{resumen.dias_corridos}</span>
            </p>
          ) : (
            <p>
              Días hábiles:{" "}
              <span className="font-semibold tabular-nums">{resumen.dias_habiles}</span> (según calendario
              institucional)
            </p>
          )}
          {lineasDescontados.length > 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-700">Días descontados del cómputo</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                {lineasDescontados.map((linea) => (
                  <li key={linea.key}>{linea.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : mostrarResumen && !isLoading && fechaDesde && fechaHasta ? (
        <p className={TICKETERA.muted}>Completá un rango de fechas válido para ver el resumen.</p>
      ) : null}

      {mostrarResumen && mensajes.length > 0 ? (
        <div className={ok ? TICKETERA.alertOk : TICKETERA.alertError} role={ok ? "status" : "alert"}>
          <ul className="list-inside list-disc space-y-0.5">
            {mensajes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
