/**
 * Resumen de `previsualizarSolicitudPatronB` (motor Patrón B, sin persistir).
 * @param {{ preview: Record<string, unknown> | null, error: string, cargando?: boolean }} props
 */
export default function PatronBPreviewInfo({ preview, error, cargando }) {
  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600" role="status">
        Validando elegibilidad y saldos…
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
  if (!preview) return null;

  const eligible = preview.eligible === true || preview.ok === true;
  const mensajes = Array.isArray(preview.mensajes) ? preview.mensajes.filter(Boolean) : [];
  const saldo = preview.saldo_ciclo && typeof preview.saldo_ciclo === "object" ? preview.saldo_ciclo : null;
  const freq = preview.frecuencia_mes && typeof preview.frecuencia_mes === "object" ? preview.frecuencia_mes : null;

  const shellClass = eligible ? "border-emerald-100 bg-emerald-50/60" : "border-red-200 bg-red-50/80";

  return (
    <section className={`space-y-3 rounded-xl border p-4 text-sm text-slate-800 ${shellClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Previsualización</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            eligible ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {eligible ? "Podés enviar" : "No podés enviar"}
        </span>
      </div>

      {!eligible && mensajes.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 text-red-950">
          {mensajes.map((m) => (
            <li key={String(m)}>{String(m)}</li>
          ))}
        </ul>
      ) : null}

      {eligible ? (
        <div className="space-y-1 text-slate-700">
          <p>
            Fechas: <span className="font-mono">{String(preview.fecha_desde || "")}</span>
            {preview.fecha_hasta && preview.fecha_hasta !== preview.fecha_desde ? (
              <>
                {" "}
                → <span className="font-mono">{String(preview.fecha_hasta)}</span>
              </>
            ) : null}
            {" · "}
            {Number(preview.dias_solicitados) || 1} día(s)
          </p>
          {saldo ? (
            <p>
              Saldo ciclo {saldo.anio_ciclo_consumo}: disponible{" "}
              <strong>{saldo.saldo_disponible}</strong> → tras envío{" "}
              <strong>{saldo.saldo_restante_preview}</strong> (consumo {saldo.dias_consumo}).
            </p>
          ) : null}
          {freq && Number(freq.tope_mes) > 0 ? (
            <p>
              Solicitudes en el mes: {freq.en_mes} de {freq.tope_mes} permitidas (esta sumaría 1 más al enviar).
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
