import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, { eventos?: unknown[], rda_turno_id?: string, es_franco?: boolean }> | null;
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
        const turnoId = cell.rda_turno_id || null;
        const esFranco = cell.es_franco === true;
        const tieneDatos = tieneEventos || turnoId || esFranco;

        const bgFranco = esFranco && !turnoId ? "bg-slate-100" : "";
        const tachado = tieneEventos && turnoId ? "line-through opacity-60" : "";

        return (
          <GrillaMesCeldaLicencia
            key={dia}
            eventos={Array.isArray(eventos) ? eventos : []}
            dia={dia}
            disabled={!tieneDatos}
            onClick={() => tieneDatos && onDiaClick({ dia, eventos: Array.isArray(eventos) ? eventos : [] })}
            className={`flex min-h-[3rem] flex-col items-center justify-center rounded text-center text-[10px] font-semibold ${bgFranco}`}
          >
            <span className="text-[9px] opacity-80">{Number(dia)}</span>
            {turnoId && (
              <span className={`text-[9px] font-bold text-indigo-600 ${tachado}`}>{turnoId}</span>
            )}
            {esFranco && !turnoId && !tieneEventos && (
              <span className="text-[9px] text-slate-400">F</span>
            )}
            <span className="truncate px-0.5">{label}</span>
          </GrillaMesCeldaLicencia>
        );
      })}
    </div>
  );
}
