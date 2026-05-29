import {
  etiquetaCeldaAprobada,
  claseCeldaAprobada,
} from "./planGrillaAprobadaDisplay.js";
import { columnasMetadataGrilla } from "./planGrillaColumnas.js";

function labelAgente(ag) {
  const nombre = String(
    ag?.nombre || ag?.nombre_completo || ag?.persona_label || "",
  ).trim();
  const dni = String(ag?.dni || ag?.persona_dni || "").trim();
  if (nombre && dni) return `${nombre} · DNI ${dni}`;
  return nombre || dni || ag?.persona_id || "—";
}

function claseHeaderColumna(col) {
  if (col.esFeriadoCol) return "bg-amber-100 text-amber-800";
  if (col.esFinde) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

/**
 * @param {{ grillaAprobada: object, labelsPorPersona?: Record<string, { nombre?: string, dni?: string, persona_label?: string }> }} props
 */
export default function PlanGrillaAprobadaTable({ grillaAprobada, labelsPorPersona = {} }) {
  if (!grillaAprobada?.agentes?.length) {
    return <p className="text-sm text-slate-500">Sin grilla aprobada registrada.</p>;
  }

  const columnas = columnasMetadataGrilla(grillaAprobada);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="text-slate-400">
            <th className="sticky left-0 z-10 h-9 min-w-[14rem] border border-slate-300 bg-slate-100 px-2 py-0.5" />
            {columnas.map((col) => (
              <th
                key={`ds-${col.diaKey}`}
                className={`h-9 min-w-[2.5rem] border border-slate-300 px-0 py-0.5 text-[8px] font-semibold ${claseHeaderColumna(col)}`}
                title={col.diaKey}
              >
                {col.letra}
              </th>
            ))}
          </tr>
          <tr className="bg-slate-50 text-slate-600">
            <th className="sticky left-0 z-10 h-9 min-w-[14rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold text-slate-700">
              Agente
            </th>
            {columnas.map((col) => (
              <th
                key={col.diaKey}
                className={`h-9 min-w-[2.5rem] border border-slate-300 px-1 py-1 text-center font-semibold ${claseHeaderColumna(col)}`}
                title={col.diaKey}
              >
                {String(col.num).padStart(2, "0")}
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
                {columnas.map((col) => {
                  const dias = ag?.dias && typeof ag.dias === "object" ? ag.dias : {};
                  const cel =
                    dias[col.diaKey] ||
                    dias[String(col.num).padStart(2, "0")] ||
                    null;
                  const etiqueta = etiquetaCeldaAprobada(cel);
                  return (
                    <td
                      key={`${ag.persona_id}-${col.diaKey}`}
                      className={`h-10 border border-slate-300 px-0.5 py-0.5 text-center text-[10px] leading-tight ${claseCeldaAprobada(cel)}`}
                      title={cel?.fichadas_esperadas != null ? `Fichadas esp.: ${cel.fichadas_esperadas}` : col.diaKey}
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
