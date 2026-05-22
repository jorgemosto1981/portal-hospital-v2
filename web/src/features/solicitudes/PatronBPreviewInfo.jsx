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
  const saldo = preview.saldo_ciclo && typeof preview.saldo_ciclo === "object" ? preview.saldo_ciclo : null;

  if (!eligible) return null;

  return (
    <section className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-800">
      <div className="space-y-2 text-slate-700">
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
        {preview.calendario_resumen ? (
          <p className="text-slate-600">
            {preview.modo_computo === "CORRIDOS" ? (
              <>
                Modo <strong>días corridos</strong>: en el rango hay{" "}
                <strong>{preview.calendario_resumen.dias_corridos}</strong> día(s) de calendario.
              </>
            ) : (
              <>
                Días corridos: <strong>{preview.calendario_resumen.dias_corridos}</strong>
                {" · "}
                Días hábiles
                {preview.incluye_feriados_institucionales ? " (con calendario RRHH)" : " (lun–vie)"}:{" "}
                <strong>{preview.calendario_resumen.dias_habiles}</strong>
              </>
            )}
          </p>
        ) : null}
        {saldo ? (
          <p>
            Saldo ciclo {saldo.anio_ciclo_consumo}: disponible{" "}
            <strong>{saldo.saldo_disponible}</strong> → tras envío{" "}
            <strong>{saldo.saldo_restante_preview}</strong> (consumo {saldo.dias_consumo}).
          </p>
        ) : null}
      </div>
    </section>
  );
}
