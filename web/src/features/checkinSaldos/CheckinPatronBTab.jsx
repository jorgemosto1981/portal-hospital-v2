import { useMemo } from "react";

import { validateCheckinEstandar } from "./validateCheckinEstandar.js";

function saldoInicial(cupo, usados) {
  if (cupo == null || !Number.isFinite(usados) || usados < 0) return null;
  return Math.max(0, cupo - usados);
}

/**
 * @param {{ articulosPatron: Array<{ id: string, codigo: string, nombre: string, cupoDiasPorCiclo: number | null, validacionPorEventoSinTopeAnual?: boolean, versionId: string }>, loading: boolean, anioA: number, diasPorArticulo: Record<string, string>, onDiasChange: (articuloId: string, value: string) => void, disabled?: boolean }}
 */
export function CheckinPatronBTab({
  articulosPatron,
  loading,
  anioA,
  diasPorArticulo,
  onDiasChange,
  disabled,
}) {
  const rows = useMemo(() => {
    return articulosPatron.map((a) => {
      const raw = String(diasPorArticulo[a.id] ?? "").trim();
      const hasValue = raw !== "";
      const usados = hasValue ? Number(raw) : null;
      const cupo = a.cupoDiasPorCiclo != null ? Number(a.cupoDiasPorCiclo) : null;
      let validation = null;
      if (hasValue && anioA != null) {
        validation = validateCheckinEstandar({
          anioCiclo: String(anioA),
          diasConsumidosPrevios: raw,
          cupoDiasPorCiclo: cupo,
          anioA,
        });
      }
      const saldo =
        hasValue && validation?.ok
          ? saldoInicial(cupo, validation.usados)
          : hasValue && cupo != null && Number.isFinite(usados)
            ? saldoInicial(cupo, usados)
            : null;

      return { ...a, raw, hasValue, validation, saldo, cupo };
    });
  }, [articulosPatron, diasPorArticulo, anioA]);

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando artículos patrón B…</p>;
  }

  if (!articulosPatron.length) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        No hay artículos vigentes con patrón B para el año A seleccionado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Año del ciclo: <strong>{anioA}</strong> (igual al año de corte A, no modificable). Completá solo las filas que
        correspondan; la validación de cupo se muestra al ingresar días usados.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Artículo</th>
              <th className="px-3 py-2">Días ya usados</th>
              <th className="px-3 py-2">Saldo inicial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 align-top">
                  <span className="font-semibold text-slate-900">{row.codigo}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{row.nombre || row.id}</span>
                  {row.validacionPorEventoSinTopeAnual ? (
                    <span className="mt-1 block text-xs font-medium text-violet-900">
                      Validación por evento (Sin tope anual)
                    </span>
                  ) : null}
                  {row.hasValue && row.cupo != null ? (
                    <span className="mt-1 block text-xs text-blue-800">
                      Cupo del ciclo (configurador): <strong>{row.cupo}</strong> días
                    </span>
                  ) : null}
                  {row.hasValue && row.validation && !row.validation.ok ? (
                    <span className="mt-1 block text-xs text-red-700">{row.validation.message}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    disabled={disabled || row.validacionPorEventoSinTopeAnual}
                    value={diasPorArticulo[row.id] ?? ""}
                    onChange={(e) => onDiasChange(row.id, e.target.value)}
                    placeholder={row.validacionPorEventoSinTopeAnual ? "N/A" : "—"}
                    className="min-h-11 w-full max-w-[7rem] rounded-lg border border-slate-200 px-2 text-base disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="inline-flex min-h-11 items-center font-medium text-slate-800">
                    {row.validacionPorEventoSinTopeAnual
                      ? "Validación por evento (Sin tope anual)"
                      : row.saldo != null
                        ? `${row.saldo} días`
                        : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
