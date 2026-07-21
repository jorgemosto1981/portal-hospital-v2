import { ymdToDdMmYyyy } from "./cambioDiaUi.js";

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
  const saldo64 =
    preview.saldo_familia_64 && typeof preview.saldo_familia_64 === "object"
      ? preview.saldo_familia_64
      : null;
  const desdeUi = ymdToDdMmYyyy(preview.fecha_desde);
  const hastaUi = ymdToDdMmYyyy(preview.fecha_hasta);

  if (!eligible) return null;

  return (
    <section className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-slate-800">
      <div className="space-y-2 text-slate-700">
        <p>
          Fechas: <span className="font-medium tabular-nums">{desdeUi || "—"}</span>
          {hastaUi && hastaUi !== desdeUi ? (
            <>
              {" "}
              → <span className="font-medium tabular-nums">{hastaUi}</span>
            </>
          ) : null}
          {" · "}
          {Number(preview.dias_solicitados) || 1} día(s)
        </p>
        {saldo64 ? (
          <div className="space-y-1">
            <p>
              Saldo disponible ciclo {saldo64.anio_ciclo_consumo}:{" "}
              <strong>con sueldo {saldo64.con_goce_disponible ?? "—"}</strong>
              {" · "}
              <strong>sin sueldo {saldo64.sin_goce_disponible ?? "—"}</strong>
            </p>
            <p className="text-sm text-slate-600">
              La modalidad (con o sin goce de haberes) la define tu jefe al autorizar; ahí impacta
              el saldo correspondiente.
            </p>
          </div>
        ) : saldo && saldo.saldo_disponible != null ? (
          <p>
            Saldo ciclo {saldo.anio_ciclo_consumo}: disponible{" "}
            <strong>{saldo.saldo_disponible}</strong> → tras envío{" "}
            <strong>{saldo.saldo_restante_preview}</strong> (consumo {saldo.dias_consumo}).
          </p>
        ) : null}
        {preview.familia_64_ruta &&
        typeof preview.familia_64_ruta === "object" &&
        String(preview.familia_64_ruta.mensaje || "").trim() ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950">
            {String(preview.familia_64_ruta.mensaje)}
          </p>
        ) : null}
        {preview.licencia_medica_preview &&
        typeof preview.licencia_medica_preview === "object" ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-violet-950">
            <p className="font-medium">Licencia médica — proyección</p>
            <p className="mt-1 text-sm">{String(preview.licencia_medica_preview.mensaje_ui || "")}</p>
            {preview.licencia_medica_preview.mensaje_ui_corto ? (
              <p className="mt-1 font-mono text-xs">
                {String(preview.licencia_medica_preview.mensaje_ui_corto)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
