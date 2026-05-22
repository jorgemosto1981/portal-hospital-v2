import { TICKETERA } from "../solicitudes/ticketeraUi.js";

/**
 * Paso 1 — disponibilidad de bolsa LAO (RFC §3).
 * @param {{
 *   resumen: object | null,
 *   loading: boolean,
 *   error: string | null,
 *   anioOrigenBolsa: string,
 *   onAnioOrigenBolsaChange: (v: string) => void,
 * }} props
 */
export default function LaoDisponibilidadPaso({
  resumen,
  loading,
  error,
  anioOrigenBolsa,
  onAnioOrigenBolsaChange,
}) {
  if (loading) {
    return (
      <p className={TICKETERA.muted} role="status">
        Consultando tu bolsa y ejercicio LAO…
      </p>
    );
  }

  if (error) {
    return (
      <div className={TICKETERA.alertError} role="alert">
        {error}
      </div>
    );
  }

  if (!resumen) {
    return <p className={TICKETERA.muted}>Seleccioná un artículo LAO válido para continuar.</p>;
  }

  const bolsas = Array.isArray(resumen.bolsas_resumen) ? resumen.bolsas_resumen : [];
  const bolsa = resumen.bolsa_seleccionada;
  const mensajes = Array.isArray(resumen.mensajes) ? resumen.mensajes : [];
  const disp = bolsa ? Number(bolsa.disponible) : null;

  return (
    <div className="space-y-4">
      {resumen.ejercicio_label ? (
        <div>
          <p className={TICKETERA.label}>Ejercicio LAO</p>
          <p className="text-lg font-semibold text-slate-900">{resumen.ejercicio_label}</p>
          {resumen.correspondencia_anio ? (
            <p className="mt-1 text-sm text-slate-600">
              Año de correspondencia: <span className="font-mono">{resumen.correspondencia_anio}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {bolsas.length > 1 ? (
        <div>
          <label htmlFor="lao-anio-origen" className={TICKETERA.label}>
            Año origen de bolsa
          </label>
          <select
            id="lao-anio-origen"
            className={TICKETERA.select}
            value={anioOrigenBolsa}
            onChange={(e) => onAnioOrigenBolsaChange(e.target.value)}
          >
            {bolsas.map((b) => (
              <option key={b.bolsa_id} value={String(b.anio_origen)}>
                {b.anio_origen} — {b.disponible} día(s) disponible(s)
                {b.requiere_fifo_antes ? " (consumir años anteriores primero)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className={`${TICKETERA.card} ${TICKETERA.cardPad} border-emerald-100 bg-emerald-50/50`}>
        <p className={TICKETERA.label}>Días disponibles en la bolsa activa</p>
        {bolsa ? (
          <>
            <p className="text-3xl font-bold tabular-nums text-emerald-950">
              {Number.isFinite(disp) ? disp : "—"}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Bolsa año origen <span className="font-mono font-medium">{bolsa.anio_origen}</span>
              {bolsa.es_arrastre ? " · saldo de arrastre" : ""}
              {bolsa.fecha_vencimiento ? (
                <>
                  {" "}
                  · vence <span className="font-mono">{bolsa.fecha_vencimiento}</span>
                </>
              ) : null}
            </p>
            {Number.isFinite(Number(bolsa.consumido)) ? (
              <p className="text-xs text-slate-600">
                Consumido: {bolsa.consumido} / inicial {bolsa.cantidad_inicial}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-amber-900">No hay bolsa seleccionada para el año indicado.</p>
        )}
      </div>

      {resumen.fifo?.debe_respetar_fifo ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Debés respetar el orden FIFO: consumí primero la bolsa del año{" "}
          <strong>{resumen.fifo.anio_mas_antiguo_con_saldo}</strong>.
        </p>
      ) : null}

      {mensajes.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {mensajes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      {bolsas.length > 1 ? (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-800">Ver todas las bolsas</summary>
          <ul className="mt-2 space-y-1">
            {bolsas.map((b) => (
              <li key={b.bolsa_id} className="font-mono text-xs">
                {b.anio_origen}: {b.disponible} disp. · {b.consumido} cons.
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
