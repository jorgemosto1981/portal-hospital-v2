/**
 * Alertas semánticas de validación fichada (lazy — solo en modal, no en listado).
 */

import { etiquetaHerramientaSugerida } from "./validacionFichadaAlertasUi.js";

/**
 * @param {{ celdaVis?: Record<string, unknown> | null }} props
 */
export default function DiaGrillaValidacionFichadaAlertas({ celdaVis }) {
  const val = celdaVis?.validacion_fichada_dia;
  const alertas = Array.isArray(val?.alertas_semanticas) ? val.alertas_semanticas : [];
  if (alertas.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">Qué revisar</h4>
      <p className="mt-0.5 text-xs text-slate-500">
        Resumen operativo del día (sin repetir cifras técnicas de liquidación).
      </p>
      <ul className="mt-3 space-y-2">
        {alertas.map((a, idx) => {
          const codigo = String(a?.codigo || "");
          const key = codigo || `alerta-${idx}`;
          const accion = etiquetaHerramientaSugerida(a?.herramienta_sugerida);
          return (
            <li
              key={key}
              className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <p className="font-medium leading-snug text-slate-900">{a?.texto_humano || codigo}</p>
              {accion ? (
                <p className="mt-1 text-xs text-indigo-800">
                  Siguiente paso: <span className="font-medium">{accion}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
