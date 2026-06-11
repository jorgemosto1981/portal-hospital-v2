import { useMemo } from "react";

import {
  celdaTieneAuditoriaTecnicaVisible,
  formatearMarcasCrudasFichada,
  lineasAlertaAuditoriaModal,
  resumenTeoricoParaAuditoria,
} from "./grillaAuditoriaModalTecnica.js";

/**
 * @param {{
 *   celdaVis: Record<string, unknown> | null;
 *   turnoTeorico?: { rda_turno_id?: string; capa_teorica?: Record<string, unknown> } | null;
 *   desalineacionTeoria?: boolean;
 *   desalineacionTooltip?: string;
 *   onAbrirAyuda?: (termino: string) => void;
 * }} props
 */
export default function DiaGrillaAuditoriaTecnicaRrhh({
  celdaVis,
  turnoTeorico = null,
  desalineacionTeoria = false,
  desalineacionTooltip = "",
  onAbrirAyuda,
}) {
  const marcas = useMemo(() => formatearMarcasCrudasFichada(celdaVis), [celdaVis]);
  const alertas = useMemo(
    () =>
      lineasAlertaAuditoriaModal(celdaVis, {
        desalineacionTeoria,
        desalineacionTooltip,
      }),
    [celdaVis, desalineacionTeoria, desalineacionTooltip],
  );
  const teorico = useMemo(
    () => resumenTeoricoParaAuditoria(celdaVis, turnoTeorico),
    [celdaVis, turnoTeorico],
  );

  const mostrar =
    celdaVis &&
    (celdaTieneAuditoriaTecnicaVisible(celdaVis) ||
      alertas.length > 0 ||
      Boolean(turnoTeorico?.capa_teorica || turnoTeorico?.rda_turno_id));
  if (!mostrar) return null;

  return (
    <details
      open
      className="mt-3 rounded-lg border border-violet-200 bg-violet-50/40"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-violet-900">
        Auditoría técnica (RRHH)
      </summary>
      <div className="space-y-3 border-t border-violet-100 px-3 pb-3 pt-2 text-xs text-slate-800">
        <div>
          <p className="font-semibold text-slate-700">Teoría vigente en celda</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
            <div>
              <dt className="text-slate-500">Turno</dt>
              <dd className="font-medium">{teorico.turnoId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo día</dt>
              <dd className="font-medium capitalize">{teorico.tipoDia}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Horario teórico</dt>
              <dd className="font-medium">{teorico.horario}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Fichadas esperadas</dt>
              <dd className="font-medium">{teorico.fichadasEsperadas}</dd>
            </div>
          </dl>
        </div>

        {alertas.length > 0 ? (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li
                key={a.codigo}
                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950"
              >
                <p>{a.texto}</p>
                {onAbrirAyuda ? (
                  <button
                    type="button"
                    onClick={() => onAbrirAyuda(a.terminoAyuda)}
                    className="mt-1 text-[11px] font-semibold text-violet-800 underline"
                  >
                    Ver regla en ayuda
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div>
          <p className="font-semibold text-slate-700">Marcas crudas del reloj (sin sanitizar)</p>
          {marcas.length === 0 ? (
            <p className="mt-1 text-slate-600">Capa cargada · sin marcas en el día.</p>
          ) : (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[16rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1 pr-2">Tipo</th>
                    <th className="py-1 pr-2">Ingreso</th>
                    <th className="py-1 pr-2">Egreso</th>
                    <th className="py-1">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {marcas.map((m) => (
                    <tr key={m.indice} className="border-b border-slate-100 font-mono text-[11px]">
                      <td className="py-1 pr-2">{m.indice}</td>
                      <td className="py-1 pr-2">{m.tipo}</td>
                      <td className="py-1 pr-2">{m.ingreso}</td>
                      <td className="py-1 pr-2">{m.egreso}</td>
                      <td className="py-1">{m.hora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
