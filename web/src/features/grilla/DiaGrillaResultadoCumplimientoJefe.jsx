import { useMemo } from "react";

import {
  resultadoAnalisisFichadaJefe,
  toleranciasTextoDesdeAnalitica,
} from "./resumenCumplimientoFichadaJefe.js";

/**
 * @param {{ celdaVis?: Record<string, unknown> | null; modoJefe?: boolean }} props
 */
export default function DiaGrillaResultadoCumplimientoJefe({ celdaVis, modoJefe = true }) {
  const resultado = useMemo(() => resultadoAnalisisFichadaJefe(celdaVis), [celdaVis]);
  const margenes = useMemo(
    () => toleranciasTextoDesdeAnalitica(celdaVis?.analitica_cumplimiento),
    [celdaVis],
  );

  if (!modoJefe || !celdaVis) return null;

  const boxClass =
    resultado.hayDesvioTecnico && celdaVis.resuelto_rrhh !== true
      ? "border-amber-200 bg-amber-50/90"
      : resultado.hayDesvioTecnico && celdaVis.resuelto_rrhh === true
        ? "border-emerald-200 bg-emerald-50/80"
        : "border-slate-200 bg-slate-50";

  return (
    <div className={`mt-3 rounded-lg border p-3 ${boxClass}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        Resultado del análisis (fichada vs teoría)
      </h4>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{resultado.titulo}</p>
      {resultado.detalle ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-700">{resultado.detalle}</p>
      ) : null}
      {margenes.length > 0 ? (
        <div className="mt-2 border-t border-slate-200/80 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Márgenes usados (materializados desde régimen / turno)
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {margenes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-[10px] text-slate-500">
        Origen: <code className="text-[10px]">cfg_regimen_horario</code> (tolerancias del turno M y débito del
        régimen) → capa teórica del día al materializar.
      </p>
    </div>
  );
}
