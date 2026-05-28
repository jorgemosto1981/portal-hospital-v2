import {
  columnasDesdeGrillaAprobada,
  etiquetaCeldaAprobada,
  claseCeldaAprobada,
} from "./planGrillaAprobadaDisplay.js";

function labelAgente(ag) {
  const nombre = String(ag?.nombre || ag?.nombre_completo || "").trim();
  const dni = String(ag?.dni || "").trim();
  if (nombre && dni) return `${nombre} (${dni})`;
  return nombre || dni || ag?.persona_id || "—";
}

/**
 * @param {{ grillaAprobada: object, labelsPorPersona?: Record<string, { nombre?: string, dni?: string }> }} props
 */
export default function PlanGrillaAprobadaTable({ grillaAprobada, labelsPorPersona = {} }) {
  if (!grillaAprobada?.agentes?.length) {
    return <p className="text-sm text-slate-500">Sin grilla aprobada registrada.</p>;
  }

  const columnas = columnasDesdeGrillaAprobada(grillaAprobada);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 h-9 min-w-[14rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold text-slate-700">
              Agente
            </th>
            {columnas.map((d) => (
              <th
                key={d}
                className="h-9 min-w-[2.5rem] border border-slate-300 bg-slate-100 px-1 py-1 text-center font-semibold text-slate-600"
                title={d}
              >
                {d.slice(-2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grillaAprobada.agentes.map((ag) => {
            const meta = labelsPorPersona[ag.persona_id] || {};
            const rowLabel = labelAgente({ ...ag, ...meta });
            return (
              <tr key={ag.persona_id}>
                <td className="sticky left-0 z-10 whitespace-nowrap border border-slate-300 bg-white px-2 py-2 font-medium text-slate-800">
                  {rowLabel}
                </td>
                {columnas.map((dia) => {
                  const cel = ag?.dias?.[dia];
                  const etiqueta = etiquetaCeldaAprobada(cel);
                  return (
                    <td
                      key={`${ag.persona_id}-${dia}`}
                      className={`h-10 border border-slate-300 px-0.5 py-0.5 text-center text-[10px] leading-tight ${claseCeldaAprobada(cel)}`}
                      title={cel?.fichadas_esperadas != null ? `Fichadas esp.: ${cel.fichadas_esperadas}` : dia}
                    >
                      {etiqueta || "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
