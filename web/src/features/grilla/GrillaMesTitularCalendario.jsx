import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";
import { claseTdColumna } from "./grillaTurnosVisual.js";
import { celdaTieneJornadaVis } from "./grillaMesEquipoDisplay.js";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 7 : d;
}

/**
 * Calendario titular — un bounded context (vis_* ya scoped por gdt en backend).
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, object> | null;
 *   grupoLabel?: string;
 *   onDiaClick: (payload: { dia: string; eventos: unknown[]; grupoLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesTitularCalendario({ anio, mes, diasMap, grupoLabel, onDiaClick }) {
  const map = diasMap && typeof diasMap === "object" ? diasMap : {};
  const totalDias = diasEnMes(anio, mes);
  const offset = primerDiaSemana(anio, mes) - 1;

  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-px rounded-xl border border-slate-300 bg-slate-300 p-px">
        {DIAS_SEMANA.map((nombre, idx) => (
          <div
            key={nombre}
            className={`h-10 bg-slate-100 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
              idx >= 5 ? "text-rose-700" : "text-slate-600"
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
          const colPos = (offset + i) % 7;
          const esFinDeSemana = colPos >= 5;
          const eventos = cell.eventos;
          const label = etiquetaCelda(eventos);
          const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
          const turnoId = cell.rda_turno_id || null;
          const egreso = cell.rda_egreso || null;
          const tipoDia = String(cell.tipo_dia || "").trim().toLowerCase().replace(/\s+/g, "_");
          const jornadaVis = celdaTieneJornadaVis(cell);
          const esNoLaborable =
            !jornadaVis && (tipoDia === "no_laborable" || tipoDia === "no-laborable");
          const esFranco = cell.es_franco === true && !esNoLaborable && !jornadaVis;
          const esFeriado = cell.es_feriado === true;
          const tipoEvento = cell.tipo_evento_institucional || null;
          const tieneDatos = tieneEventos || turnoId || esFranco || esNoLaborable || esFeriado;
          const ingreso = cell.rda_ingreso || null;
          const turnoLabel = esNoLaborable
            ? "NL"
            : esFranco
              ? "F"
              : ingreso && egreso
                ? `${ingreso}–${egreso}`
                : turnoId;
          const bgCelda = claseTdColumna({
            esFinde: esFinDeSemana,
            esFeriado,
          });
          const chipNl = esNoLaborable ? "bg-slate-200 text-slate-700" : "";
          const chipFranco = esFranco && !esNoLaborable && !esFeriado ? "bg-slate-400 text-slate-900" : "";
          const chipTurno = turnoLabel && !esNoLaborable && !esFranco ? "bg-green-300 text-green-950" : "";
          const tachado = tieneEventos && turnoId ? "line-through opacity-60" : "";
          const titleParts = [];
          if (esFeriado && tipoEvento) {
            titleParts.push(tipoEvento === "feriado" ? "Feriado" : tipoEvento === "asueto" ? "Asueto" : "Día institucional");
          }
          if (turnoLabel) titleParts.push(turnoLabel);

          return (
            <GrillaMesCeldaLicencia
              key={dia}
              eventos={Array.isArray(eventos) ? eventos : []}
              dia={dia}
              disabled={!tieneDatos}
              onClick={() => tieneDatos && onDiaClick({
                dia,
                eventos: Array.isArray(eventos) ? eventos : [],
                grupoLabel: grupoLabel || cell.etiqueta_grupo_corta || null,
              })}
              className={`flex min-h-[5rem] flex-col items-center justify-center rounded-none border border-slate-300 text-center text-[10px] font-semibold ${bgCelda}`}
              title={titleParts.join(" · ") || undefined}
            >
              <span className={`text-[9px] ${esFinDeSemana ? "text-rose-400" : "opacity-80"}`}>
                {Number(dia)}
              </span>
              {turnoLabel && !esNoLaborable && (
                <span className={`rounded border border-slate-400 px-1 text-[8px] font-bold ${chipTurno} ${tachado}`}>
                  {turnoLabel}
                </span>
              )}
              {esFranco && !turnoLabel && !tieneEventos && !esFeriado && (
                <span className={`rounded border border-slate-400 px-1 text-[8px] font-bold ${chipFranco}`}>F</span>
              )}
              {esNoLaborable && (
                <span className={`rounded border border-slate-400 px-1 text-[8px] font-bold ${chipNl}`}>NL</span>
              )}
              <span className="truncate px-0.5">{label}</span>
            </GrillaMesCeldaLicencia>
          );
        })}
      </div>
    </div>
  );
}
