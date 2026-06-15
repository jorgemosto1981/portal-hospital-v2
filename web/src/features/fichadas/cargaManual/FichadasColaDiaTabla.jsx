/**
 * @param {{
 *   items: Array<Record<string, unknown>>;
 *   pendientesCount: number;
 *   maxPendientes: number;
 *   onDeshacer: (item: Record<string, unknown>) => void;
 *   onEnviar: () => void;
 *   enviando: boolean;
 *   deshaciendo: boolean;
 * }} props
 */
export default function FichadasColaDiaTabla({
  items,
  pendientesCount,
  maxPendientes,
  onDeshacer,
  onEnviar,
  enviando,
  deshaciendo,
}) {
  const tienePendientes = pendientesCount > 0;

  if (!items.length) {
    return (
      <p className="text-sm text-slate-500">
        Cola vacía. Precargá hasta {maxPendientes} registros con Enter en Egreso; luego pulsá Enviar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          Pendientes: <strong>{pendientesCount}</strong> / {maxPendientes}
          {pendientesCount >= maxPendientes ? " · cola completa" : ""}
        </p>
        {tienePendientes ? (
          <button
            type="button"
            disabled={enviando || deshaciendo}
            onClick={onEnviar}
            className="min-h-11 touch-manipulation rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white active:bg-violet-800 disabled:opacity-50"
          >
            {enviando ? "Enviando…" : `Enviar ${pendientesCount} registro(s)`}
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Agente</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Marcas</th>
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((row) => {
              const esPendiente = row.estado === "pendiente";
              const horaLabel = esPendiente ? row.agregado_en_label : row.guardado_en_label;
              const gdt = String(row.grupo_trabajo_id || "");
              const gdtCorto = gdt.length > 12 ? `${gdt.slice(0, 8)}…` : gdt;
              return (
                <tr key={row.id} className={esPendiente ? "bg-amber-50/40" : ""}>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        esPendiente
                          ? "rounded bg-amber-200 px-1.5 py-0.5 font-semibold text-amber-950"
                          : "rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900"
                      }
                    >
                      {esPendiente ? "Pendiente" : "Enviado"}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{horaLabel || "—"}</td>
                  <td className="px-3 py-2 max-w-[10rem] truncate">{row.persona_label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.fecha_ymd}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {[row.ingreso, row.egreso].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-500" title={gdt}>
                    {gdtCorto || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={enviando || deshaciendo}
                      className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                      onClick={() => onDeshacer(row)}
                    >
                      {esPendiente ? "Quitar" : "Deshacer"}
                    </button>
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
