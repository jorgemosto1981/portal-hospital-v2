import { MODO_COMPUTO_CORRIDOS } from "../../../../shared/utils/modoComputoCalendario.js";
import { TICKETERA } from "../solicitudes/ticketeraUi.js";

/**
 * Paso 2 — rango de fechas + resumen de cómputo (RFC §5).
 */
export default function LaoFechasPaso({
  ejercicioLabel = null,
  anioOrigenBolsa = null,
  fechaDesde,
  setFechaDesde,
  fechaHasta,
  setFechaHasta,
  isLoading = false,
  modoComputo = "",
  resumenComputo = null,
  mensajes = [],
  ok = false,
}) {
  const esCorridos = modoComputo === MODO_COMPUTO_CORRIDOS;
  const resumen = resumenComputo;

  return (
    <div className="space-y-4">
      {ejercicioLabel ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-950">
          Ejercicio: <span className="font-medium">{ejercicioLabel}</span>
          {anioOrigenBolsa != null ? (
            <span className="mt-0.5 block text-xs text-emerald-800">
              Bolsa activa (año origen): {anioOrigenBolsa}
            </span>
          ) : null}
        </p>
      ) : null}

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

      {isLoading ? (
        <p className={`${TICKETERA.muted} text-xs`} role="status">
          Cargando calendario institucional…
        </p>
      ) : null}

      {resumen ? (
        <div
          className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-slate-900">Resumen de cómputo</p>
          {esCorridos ? (
            <p>
              Días totales de calendario: <span className="font-semibold tabular-nums">{resumen.dias_corridos}</span>
            </p>
          ) : (
            <>
              <p>
                Días hábiles:{" "}
                <span className="font-semibold tabular-nums">{resumen.dias_habiles}</span> (según calendario
                institucional)
              </p>
              <p className="text-xs text-slate-600">
                Días de calendario en el rango:{" "}
                <span className="tabular-nums">{resumen.dias_corridos}</span>
              </p>
            </>
          )}
          <p className="font-medium text-sky-900">
            Este pedido consume:{" "}
            <span className="tabular-nums">{resumen.dias_consumo}</span>{" "}
            {resumen.dias_consumo === 1 ? "día" : "días"}
          </p>
          {resumen.dias_descontados?.length > 0 ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-700">Días descontados del cómputo</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                {resumen.dias_descontados.map((dia) => (
                  <li key={dia.fecha}>
                    {dia.fecha_formateada} ({dia.motivo})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : !isLoading && fechaDesde && fechaHasta ? (
        <p className={TICKETERA.muted}>Completá un rango de fechas válido para ver el resumen.</p>
      ) : null}

      {mensajes.length > 0 ? (
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
