/**
 * Resumen legible del resultado de `simularLaoPreview` (motor LAO §4.1).
 * El padre obtiene datos vía `callSimularLaoPreview` en `web/src/services/callables.js`.
 */

/**
 * @param {{ simulacion: object | null, error: string | null, cargando?: boolean, modoWizard?: boolean }} props
 */
export default function LaoPreviewInfo({ simulacion, error, cargando, modoWizard = false }) {
  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600" role="status">
        Calculando preview del derecho…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950" role="alert">
        {error}
      </div>
    );
  }
  if (!simulacion || simulacion.ok !== true) {
    return null;
  }

  const gJul = simulacion.guardas?.julio_primero;
  const gTse = simulacion.guardas?.tse_180;
  const mx = simulacion.matriz;
  const pr = simulacion.proporcional;
  const eligible = simulacion.eligible !== false;
  const motivos = Array.isArray(simulacion.motivos_ineligibilidad) ? simulacion.motivos_ineligibilidad : [];

  const shellClass = eligible
    ? "border-emerald-100 bg-emerald-50/60"
    : "border-red-200 bg-red-50/80";

  return (
    <section className={`space-y-3 rounded-xl border p-4 text-base text-slate-800 ${shellClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-semibold text-slate-900">
          {modoWizard ? "Resultado" : "Análisis de tu derecho (preview LAO)"}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            eligible ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {eligible ? "Habilitado para enviar" : "No habilitado para enviar"}
        </span>
      </div>
      {!eligible && motivos.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-white/90 p-3 text-sm text-red-950" role="alert">
          <p className="font-semibold">Motivos</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!modoWizard ? (
        <>
          <p className="text-sm text-slate-700">
            Camino: <span className="font-mono font-medium">{simulacion.camino}</span> · Año solicitud{" "}
            <span className="font-mono">{simulacion.anio_solicitud}</span> vs bolsa{" "}
            <span className="font-mono">{simulacion.anio_origen_bolsa}</span>
          </p>
          {mx?.escalon_elegido ? (
            <p className="text-sm">
              Escalón de antigüedad: <strong>{mx.escalon_elegido.dias_otorgados} días</strong> (umbral{" "}
              {mx.escalon_elegido.valor_anos} años, operador{" "}
              <span className="font-mono text-xs">{mx.escalon_elegido.operador_id}</span>).
            </p>
          ) : (
            <p className="text-sm text-amber-900">
              Sin escalón de matriz aplicable (revisar configuración o antigüedad).
            </p>
          )}
        </>
      ) : null}
      {!modoWizard && gTse?.aplica ? (
        <p className="text-sm">
          Servicio efectivo {simulacion.anio_solicitud}: <strong>{gTse.dias_tse} días</strong> en ventana 01/01 —{" "}
          {simulacion.fecha_desde}
          {gTse.ok ? " (habilitado ≥ 180 días)." : " (insuficiente para proporcional)." }
        </p>
      ) : null}
      {!modoWizard && pr?.aplica && pr.dias_proporcionales_piso != null ? (
        <p className="text-sm">
          Cálculo proporcional (piso):{" "}
          <strong>
            ⌊({mx?.dias_base ?? "—"} / 12) × {pr.meses_para_formula}⌋ = {pr.dias_proporcionales_piso} días
          </strong>
        </p>
      ) : null}
      {!modoWizard && gJul?.aplica ? (
        <p className={`text-sm ${gJul.ok ? "text-emerald-900" : "text-red-800"}`}>
          Guarda 01/07: {gJul.ok ? "Cumplida." : "No cumplida."} {gJul.detalle}
        </p>
      ) : null}
      {simulacion.error ? (
        <p className="text-sm font-medium text-red-800">{simulacion.error.mensaje}</p>
      ) : null}
    </section>
  );
}
