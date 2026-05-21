import { celdaPendiente, colorCelda, diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   filas: Array<Record<string, unknown>>;
 *   onCeldaClick: (payload: { dia: string; eventos: unknown[]; personaLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesEquipoTabla({ anio, mes, filas, onCeldaClick }) {
  const totalDias = diasEnMes(anio, mes);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th className="sticky left-0 z-10 min-w-[10rem] border border-slate-200 bg-slate-50 px-2 py-1 text-left">
              Persona
            </th>
            {Array.from({ length: totalDias }, (_, i) => (
              <th key={i + 1} className="border border-slate-200 px-0.5 py-1 font-normal">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td
                colSpan={totalDias + 1}
                className="border border-slate-200 px-3 py-6 text-center text-sm text-slate-500"
              >
                Sin datos. Elegí vista y período y pulsá Cargar.
              </td>
            </tr>
          ) : (
            filas.map((fila) => (
              <tr key={String(fila.persona_id)}>
                <td className="sticky left-0 z-10 max-w-[12rem] truncate border border-slate-200 bg-white px-2 py-1 text-left text-xs font-medium text-slate-800">
                  {String(fila.persona_label || fila.persona_id)}
                </td>
                {Array.from({ length: totalDias }, (_, i) => {
                  const dia = String(i + 1).padStart(2, "0");
                  const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
                  const cell = dias[dia] || {};
                  const eventos = cell.eventos;
                  const label = etiquetaCelda(eventos);
                  const bg = colorCelda(eventos);
                  const tiene = Array.isArray(eventos) && eventos.length > 0;
                  return (
                    <td key={dia} className="border border-slate-100 p-0">
                      <button
                        type="button"
                        disabled={!tiene}
                        onClick={() =>
                          tiene &&
                          onCeldaClick({
                            dia,
                            eventos,
                            personaLabel: String(fila.persona_label || ""),
                          })
                        }
                        className={[
                          "flex h-8 w-full min-w-[1.75rem] items-center justify-center font-semibold",
                          tiene ? "hover:ring-1 hover:ring-violet-400" : "",
                          celdaPendiente(eventos) ? "border border-dashed border-amber-400" : "",
                        ].join(" ")}
                        style={{ backgroundColor: label && bg ? bg : "#f8fafc" }}
                        title={label || ""}
                      >
                        {label ? label.slice(0, 4) : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
