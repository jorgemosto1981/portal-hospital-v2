import { useMemo } from "react";
import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

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
  const labelCargo = useMemo(() => String(grupoLabel || "").trim(), [grupoLabel]);

  return (
    <div className="mt-2">
      {labelCargo ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
          Cargo: {labelCargo}
        </p>
      ) : null}
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
          const esFranco = cell.es_franco === true;
          const esFeriado = cell.es_feriado === true;
          const tipoEvento = cell.tipo_evento_institucional || null;
          const tieneDatos = tieneEventos || turnoId || esFranco || esFeriado;
          const bgFranco = esFranco && !turnoId && !esFeriado ? "bg-slate-50" : "";
          const bgFeriado = esFeriado ? "bg-amber-50 ring-1 ring-inset ring-amber-200" : "";
          const bgFinDeSemana = esFinDeSemana && !tieneEventos && !esFeriado ? "bg-rose-50/40" : "";
          const tachado = tieneEventos && turnoId ? "line-through opacity-60" : "";
          const ingreso = cell.rda_ingreso || null;
          const turnoLabel = ingreso && egreso ? `${ingreso}–${egreso}` : turnoId;
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
                grupoLabel: labelCargo || cell.etiqueta_grupo_corta || null,
              })}
              className={`flex min-h-[5rem] flex-col items-center justify-center rounded-none border border-slate-200 text-center text-[10px] font-semibold ${bgFranco} ${bgFeriado} ${bgFinDeSemana}`}
              title={titleParts.join(" · ") || undefined}
            >
              <span className={`text-[9px] ${esFinDeSemana ? "text-rose-400" : "opacity-80"}`}>
                {Number(dia)}
              </span>
              {esFeriado && !turnoId && (
                <span className="text-[9px] font-bold text-amber-600">
                  {tipoEvento === "feriado" ? "FER" : tipoEvento === "asueto" ? "ASU" : "INST"}
                </span>
              )}
              {turnoLabel && (
                <span className={`text-[9px] font-bold text-indigo-600 ${tachado}`}>{turnoLabel}</span>
              )}
              {esFranco && !turnoId && !tieneEventos && !esFeriado && (
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
