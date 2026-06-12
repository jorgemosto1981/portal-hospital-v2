import { AVISO_DUPLICADO, etiquetaAvisosFichada } from "./fichadasImportTxt.js";

/**
 * @param {{
 *   filas: Array<Record<string, unknown>>;
 *   incluirPorLinea: Record<number, boolean>;
 *   onToggleIncluir: (numeroLinea: number, incluir: boolean) => void;
 *   politicaDuplicados: string;
 * }} props
 */
export default function FichadasImportPreviewTabla({
  filas,
  incluirPorLinea,
  onToggleIncluir,
  politicaDuplicados,
}) {
  if (!filas?.length) {
    return <p className="text-sm text-slate-500">Sin líneas para previsualizar.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-xs sm:text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-2 font-medium">Línea</th>
            <th className="px-2 py-2 font-medium">Tarjeta</th>
            <th className="px-2 py-2 font-medium">Persona</th>
            <th className="px-2 py-2 font-medium">Fecha</th>
            <th className="px-2 py-2 font-medium">Hora</th>
            <th className="px-2 py-2 font-medium">Disp.</th>
            <th className="px-2 py-2 font-medium">Avisos</th>
            <th className="px-2 py-2 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {filas.map((f) => {
            const n = Number(f.numero_linea);
            const ok = f.ok === true;
            const adv = Array.isArray(f.advertencias) ? f.advertencias : [];
            const esDup = adv.includes(AVISO_DUPLICADO);
            const incluir = incluirPorLinea[n] !== false;
            return (
              <tr key={n} className={!ok ? "bg-red-50/60" : esDup ? "bg-amber-50/50" : undefined}>
                <td className="px-2 py-2 font-mono text-slate-700">{n}</td>
                <td className="px-2 py-2 font-mono">{ok ? f.numero_tarjeta : "—"}</td>
                <td className="px-2 py-2 max-w-[10rem] truncate" title={String(f.persona_label || "")}>
                  {ok ? f.persona_label : "—"}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{ok ? f.fecha_ymd : "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">{ok ? f.hora_hm : "—"}</td>
                <td className="px-2 py-2 font-mono">{ok ? f.codigo_dispositivo : "—"}</td>
                <td className="px-2 py-2">
                  {!ok ? (
                    <span className="text-red-700">{f.mensaje_error || f.codigo_error}</span>
                  ) : adv.length ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        esDup ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {etiquetaAvisosFichada(adv)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {ok && esDup && politicaDuplicados !== "BLOQUEAR_APLICAR" ? (
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={incluir}
                        onChange={(e) => onToggleIncluir(n, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Incluir
                    </label>
                  ) : ok ? (
                    <span className="text-slate-400 text-[11px]">{incluir ? "Incluida" : "Excluida"}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
