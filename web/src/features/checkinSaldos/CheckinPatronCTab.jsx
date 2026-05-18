import { validateCheckinPatronC } from "./validateCheckinPatronC.js";

/**
 * @param {{ articulosPatron: Array<{ id: string, codigo: string, nombre: string }>, loading: boolean, saldosPorArticulo: Record<string, string>, onSaldoChange: (articuloId: string, value: string) => void, disabled?: boolean }}
 */
export function CheckinPatronCTab({ articulosPatron, loading, saldosPorArticulo, onSaldoChange, disabled }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Cargando artículos patrón C…</p>;
  }

  if (!articulosPatron.length) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        No hay artículos vigentes con patrón C.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600">
        <strong>Vacío</strong> = no informar ese artículo en esta sesión. <strong>0</strong> = saldo inicial cero.
        <strong> Negativo</strong> = deuda de días (el sistema registra consumo previo en la bolsa global).
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Artículo</th>
              <th className="px-3 py-2">Saldo disponible inicial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {articulosPatron.map((a) => {
              const raw = String(saldosPorArticulo[a.id] ?? "");
              const hasValue = raw.trim() !== "";
              const v = hasValue ? validateCheckinPatronC(raw) : { ok: true };
              return (
                <tr key={a.id}>
                  <td className="px-3 py-3 align-top">
                    <span className="font-semibold text-slate-900">{a.codigo}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{a.nombre || a.id}</span>
                    {hasValue && !v.ok ? (
                      <span className="mt-1 block text-xs text-red-700">{v.message}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      disabled={disabled}
                      value={saldosPorArticulo[a.id] ?? ""}
                      onChange={(e) => onSaldoChange(a.id, e.target.value)}
                      placeholder="0"
                      className="min-h-11 w-full max-w-[8rem] rounded-lg border border-slate-200 px-2 text-base"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
