import LaoPreviewInfo from "../articulos/LaoPreviewInfo.jsx";
import { TICKETERA } from "../solicitudes/ticketeraUi.js";

function LaoSimulacionLoading() {
  return (
    <div
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700">
          Validando disponibilidad operativa y contable…
        </p>
      </div>
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-3 w-full rounded bg-slate-200" />
        <div className="h-3 w-4/5 rounded bg-slate-200" />
        <div className="h-10 w-full rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

/**
 * Paso 3 — simulación motor LAO (`simularLaoPreview`).
 */
export default function LaoSimulacionPaso({
  fechaDesde = "",
  fechaHasta = "",
  diasConsumo = null,
  anioOrigenBolsa = null,
  simulacion = null,
  ok = false,
  mensajes = [],
  loading = false,
  onVolverPaso2,
}) {
  const dias = diasConsumo ?? simulacion?.resumen_computo?.dias_consumo ?? simulacion?.dias_solicitados;
  const anio = anioOrigenBolsa ?? simulacion?.anio_origen_bolsa;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        Rango:{" "}
        <span className="font-mono font-medium">
          {fechaDesde} → {fechaHasta}
        </span>
      </p>

      {loading ? <LaoSimulacionLoading /> : null}

      {!loading && !ok ? (
        <div className="space-y-3">
          <div className={TICKETERA.alertError} role="alert">
            <p className="font-semibold">No podés continuar con este pedido</p>
            {mensajes.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {mensajes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">Revisá las fechas o contactá a RRHH si el problema persiste.</p>
            )}
          </div>
          {typeof onVolverPaso2 === "function" ? (
            <button type="button" className={TICKETERA.btnSecondary} onClick={onVolverPaso2}>
              Volver al paso 2
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && ok ? (
        <div className="space-y-4">
          <div className={TICKETERA.alertOk} role="status">
            <p className="font-semibold text-emerald-950">Disponibilidad validada</p>
            <p className="mt-1 text-sm text-emerald-900">
              Se descontarán{" "}
              <span className="font-semibold tabular-nums">{dias}</span>{" "}
              {dias === 1 ? "día" : "días"} de tu bolsa{" "}
              <span className="font-semibold tabular-nums">{anio}</span>.
            </p>
          </div>
          <LaoPreviewInfo simulacion={simulacion} error={null} cargando={false} />
        </div>
      ) : null}
    </div>
  );
}
