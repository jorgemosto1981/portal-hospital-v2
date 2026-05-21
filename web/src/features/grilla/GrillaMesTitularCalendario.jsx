import { celdaPendiente, colorCelda, diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, { eventos?: unknown[] }> | null;
 *   onDiaClick: (payload: { dia: string; eventos: unknown[] }) => void;
 * }} props
 */
export default function GrillaMesTitularCalendario({ anio, mes, diasMap, onDiaClick }) {
  const totalDias = diasEnMes(anio, mes);
  const map = diasMap && typeof diasMap === "object" ? diasMap : {};

  return (
    <div className="mt-4 grid grid-cols-7 gap-1 sm:grid-cols-10 md:grid-cols-11">
      {Array.from({ length: totalDias }, (_, i) => {
        const dia = String(i + 1).padStart(2, "0");
        const cell = map[dia] || {};
        const eventos = cell.eventos;
        const label = etiquetaCelda(eventos);
        const bg = colorCelda(eventos) || "#f1f5f9";
        const pendiente = celdaPendiente(eventos);
        const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
        return (
          <button
            type="button"
            key={dia}
            disabled={!tieneEventos}
            onClick={() => tieneEventos && onDiaClick({ dia, eventos })}
            title={
              tieneEventos && eventos[0]
                ? `${eventos[0].codigo_grilla || ""} · ${eventos[0].estado_solicitud_id || ""} — clic para detalle`
                : `Día ${dia}`
            }
            className={[
              "flex min-h-[3rem] flex-col items-center justify-center rounded border text-center text-[10px] font-semibold text-slate-800",
              pendiente ? "border-dashed border-amber-400" : "border-slate-200",
              tieneEventos ? "cursor-pointer hover:ring-2 hover:ring-violet-300" : "cursor-default opacity-90",
            ].join(" ")}
            style={{ backgroundColor: label ? bg : undefined }}
          >
            <span className="text-[9px] text-slate-500">{Number(dia)}</span>
            <span className="truncate px-0.5">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
