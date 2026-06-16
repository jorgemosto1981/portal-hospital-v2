/**
 * Alertas semánticas de validación fichada (lazy — solo en modal, no en listado).
 */

/**
 * @param {{ celdaVis?: Record<string, unknown> | null }} props
 */
export default function DiaGrillaValidacionFichadaAlertas({ celdaVis }) {
  const val = celdaVis?.validacion_fichada_dia;
  const alertas = Array.isArray(val?.alertas_semanticas) ? val.alertas_semanticas : [];
  if (alertas.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900">
        Detalle asistencia
      </h4>
      <ul className="mt-2 space-y-2 text-xs text-slate-800">
        {alertas.map((a) => {
          const codigo = String(a?.codigo || "");
          const key = codigo || String(a?.texto_humano || Math.random());
          return (
            <li key={key} className="rounded border border-amber-100 bg-white/70 px-2 py-1.5">
              <p className="font-medium text-amber-950">{a?.texto_humano || codigo}</p>
              {a?.herramienta_sugerida ? (
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Acción sugerida: {String(a.herramienta_sugerida).replace(/_/g, " ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
