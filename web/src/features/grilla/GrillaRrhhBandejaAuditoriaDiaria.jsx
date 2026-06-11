import { useMemo } from "react";

import { calcularAuditoriaDiariaSector } from "./grillaAuditoriaDiariaResumen.js";

const ETIQUETAS_TIPO = {
  bloqueo_liquidacion: "Liquidación",
  fichada_impar: "Fichada impar",
  fichada_inconsistente: "Fichada vs teoría",
  teoria_pendiente: "Teoría pendiente",
};

/**
 * @param {{
 *   filas: Array<Record<string, unknown>>;
 *   anio: number;
 *   mes: number;
 *   grupoSeleccionado?: string;
 *   materializacionGrupoReciente?: boolean;
 *   onAbrirDia: (payload: Record<string, unknown>) => void;
 * }} props
 */
export default function GrillaRrhhBandejaAuditoriaDiaria({
  filas,
  anio,
  mes,
  grupoSeleccionado = "",
  materializacionGrupoReciente = false,
  onAbrirDia,
}) {
  const resumen = useMemo(
    () =>
      calcularAuditoriaDiariaSector(filas, {
        anio,
        mes,
        grupoSeleccionado,
        materializacionGrupoReciente,
      }),
    [filas, anio, mes, grupoSeleccionado, materializacionGrupoReciente],
  );

  const { contadores, itemsCriticos } = resumen;
  const totalAlertas =
    contadores.fichadasInconsistentes +
    contadores.fichadasImpares +
    contadores.teoriasPendientes +
    contadores.bloqueosLiquidacion;

  const sinAlertas = totalAlertas === 0;
  const summaryClass = sinAlertas
    ? "cursor-pointer list-none px-4 py-3 text-sm font-semibold text-emerald-900"
    : "cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900";

  const cajas = [
    { key: "fichadasInconsistentes", label: "Fichadas vs teoría", valor: contadores.fichadasInconsistentes },
    { key: "fichadasImpares", label: "Fichadas impares", valor: contadores.fichadasImpares },
    { key: "teoriasPendientes", label: "Teorías pendientes", valor: contadores.teoriasPendientes },
    { key: "bloqueosLiquidacion", label: "Bloqueos liquidación", valor: contadores.bloqueosLiquidacion },
  ];

  return (
    <details
      open
      className={`mb-4 rounded border shadow-sm ${
        sinAlertas ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
      }`}
    >
      <summary className={summaryClass}>
        <span className="inline-flex flex-wrap items-center gap-2">
          Auditoría diaria del sector
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              sinAlertas ? "bg-emerald-200 text-emerald-900" : "bg-amber-100 text-amber-900"
            }`}
          >
            {totalAlertas}
          </span>
          {sinAlertas ? (
            <span className="text-xs font-normal text-emerald-800">Sin alertas detectadas en el mes</span>
          ) : null}
        </span>
      </summary>

      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {cajas.map((c) => (
            <div
              key={c.key}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center"
            >
              <p className="text-2xl font-bold tabular-nums text-slate-900">{c.valor}</p>
              <p className="text-xs text-slate-600">{c.label}</p>
            </div>
          ))}
        </div>

        {itemsCriticos.length > 0 ? (
          <ul className="mt-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Atajos (máx. 5)
            </p>
            {itemsCriticos.map((item) => (
              <li key={`${item.tipo}-${item.fechaYmd}-${item.personaLabel}`}>
                <button
                  type="button"
                  onClick={() => onAbrirDia(item.modalPayload)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-violet-50"
                >
                  <span className="min-w-0 truncate font-medium text-slate-900">
                    {item.personaLabel}
                    <span className="font-normal text-slate-500"> · {item.fechaYmd}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-600">
                    {ETIQUETAS_TIPO[item.tipo] || item.tipo}
                    {item.codigo ? ` · ${item.codigo}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
