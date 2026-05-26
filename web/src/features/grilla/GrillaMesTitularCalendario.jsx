import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Día de semana ISO (1=Lun … 7=Dom) del primer día del mes. */
function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 7 : d;
}

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
  const offset = primerDiaSemana(anio, mes) - 1;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-px">
        {DIAS_SEMANA.map((nombre, idx) => (
          <div
            key={nombre}
            className={`py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
              idx >= 5 ? "text-rose-400" : "text-slate-500"
            }`}
          >
            {nombre}
          </div>
        ))}

        {Array.from({ length: offset }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: totalDias }, (_, i) => {
          const dia = String(i + 1).padStart(2, "0");
          const cell = map[dia] || {};
          const eventos = cell.eventos;
          const label = etiquetaCelda(eventos);
          const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
          const turnoId = cell.rda_turno_id || null;
          const esFranco = cell.es_franco === true;
          const tieneDatos = tieneEventos || turnoId || esFranco;
          const colPos = (offset + i) % 7;
          const esFinDeSemana = colPos >= 5;

          const bgFranco = esFranco && !turnoId ? "bg-slate-50" : "";
          const bgFinDeSemana = esFinDeSemana && !tieneEventos ? "bg-rose-50/40" : "";
          const tachado = tieneEventos && turnoId ? "line-through opacity-60" : "";

          return (
            <GrillaMesCeldaLicencia
              key={dia}
              eventos={Array.isArray(eventos) ? eventos : []}
              dia={dia}
              disabled={!tieneDatos}
              onClick={() => tieneDatos && onDiaClick({ dia, eventos: Array.isArray(eventos) ? eventos : [] })}
              className={`flex min-h-[3.2rem] flex-col items-center justify-center rounded text-center text-[10px] font-semibold ${bgFranco} ${bgFinDeSemana}`}
            >
              <span className={`text-[9px] ${esFinDeSemana ? "text-rose-400" : "opacity-80"}`}>{Number(dia)}</span>
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
    </div>
  );
}
