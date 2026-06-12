/**
 * @param {{
 *   items: Array<Record<string, unknown>>;
 *   onDeshacer: (item: Record<string, unknown>) => void;
 *   deshaciendo: boolean;
 * }} props
 */
export default function FichadasColaDiaTabla({ items, onDeshacer, deshaciendo }) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-500">
        Cola del día vacía. Los últimos 20 guardados de la sesión aparecen aquí (Ctrl+Z deshace el último).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-3 py-2">Hora</th>
            <th className="px-3 py-2">Agente</th>
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Marcas</th>
            <th className="px-3 py-2">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{row.guardado_en_label}</td>
              <td className="px-3 py-2 max-w-[12rem] truncate">{row.persona_label}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.fecha_ymd}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {[row.ingreso, row.egreso].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  disabled={deshaciendo}
                  className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                  onClick={() => onDeshacer(row)}
                >
                  Deshacer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
