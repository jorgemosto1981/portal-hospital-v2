import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

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
        const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
        return (
          <GrillaMesCeldaLicencia
            key={dia}
            eventos={Array.isArray(eventos) ? eventos : []}
            dia={dia}
            disabled={!tieneEventos}
            onClick={() => tieneEventos && onDiaClick({ dia, eventos })}
            className="flex min-h-[3rem] flex-col items-center justify-center rounded text-center text-[10px] font-semibold"
          >
            <span className="text-[9px] opacity-80">{Number(dia)}</span>
            <span className="truncate px-0.5">{label}</span>
          </GrillaMesCeldaLicencia>
        );
      })}
    </div>
  );
}
