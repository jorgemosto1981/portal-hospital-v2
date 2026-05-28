import { useMemo } from "react";
import { diasEnMes, etiquetaCelda } from "./grillaMesCellUtils.js";
import GrillaMesCeldaLicencia from "./GrillaMesCeldaLicencia.jsx";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 7 : d;
}

/**
 * Agrupa los días del vis_* por grupo_de_trabajo_id.
 * @returns {Array<{ gdtId: string; etiqueta: string }>} grupos únicos ordenados
 */
function extraerGruposDesdeVis(diasMap, gruposEquipo) {
  const seen = new Map();
  const equiMap = new Map();
  for (const g of gruposEquipo || []) {
    equiMap.set(g.grupo_de_trabajo_id, g.etiqueta_ui || g.grupo_de_trabajo_id);
  }

  for (const [, cell] of Object.entries(diasMap)) {
    const gdt = cell?.grupo_de_trabajo_id;
    if (gdt && !seen.has(gdt)) {
      seen.set(gdt, cell.etiqueta_grupo_corta || equiMap.get(gdt) || gdt);
    }
  }

  return [...seen.entries()]
    .map(([gdtId, etiqueta]) => ({ gdtId, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

function CalendarioGrupo({ anio, mes, diasMap, gdtId, etiqueta, esMultiGrupo, grupos, onDiaClick }) {
  const totalDias = diasEnMes(anio, mes);
  const offset = primerDiaSemana(anio, mes) - 1;

  return (
    <div className={esMultiGrupo ? "mt-4 rounded-xl border border-slate-200 bg-white p-3" : "mt-4"}>
      {esMultiGrupo && (
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-600">
          {etiqueta}
        </h4>
      )}
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
          const cell = diasMap[dia] || {};
          const cellGdt = cell.grupo_de_trabajo_id || null;
          const colPos = (offset + i) % 7;
          const esFinDeSemana = colPos >= 5;

          if (esMultiGrupo && cellGdt && cellGdt !== gdtId) {
            const otroLabel = cell.etiqueta_grupo_corta
              || grupos.find((g) => g.gdtId === cellGdt)?.etiqueta
              || cellGdt;
            const corta = otroLabel.length > 6 ? otroLabel.slice(0, 5) + "…" : otroLabel;
            return (
              <div
                key={dia}
                className={`flex min-h-[5rem] flex-col items-center justify-center rounded-none border border-slate-200 bg-slate-100 text-center ${
                  esFinDeSemana ? "bg-slate-100/80" : ""
                }`}
                title={`Asignado a ${otroLabel}`}
              >
                <span className={`text-[9px] ${esFinDeSemana ? "text-rose-300" : "opacity-50"}`}>
                  {Number(dia)}
                </span>
                <span className="text-[8px] text-slate-400">{corta}</span>
              </div>
            );
          }

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

          const grupoLabel = cell.etiqueta_grupo_corta
            || grupos.find((g) => g.gdtId === cellGdt)?.etiqueta
            || etiqueta;

          const titleParts = [];
          if (esFeriado && tipoEvento) titleParts.push(tipoEvento === "feriado" ? "Feriado" : tipoEvento === "asueto" ? "Asueto" : "Día institucional");
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
                grupoLabel,
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

/**
 * @param {{
 *   anio: number;
 *   mes: number;
 *   diasMap: Record<string, object> | null;
 *   gruposEquipo?: Array<{ grupo_de_trabajo_id: string; etiqueta_ui?: string }>;
 *   onDiaClick: (payload: { dia: string; eventos: unknown[]; grupoLabel?: string }) => void;
 * }} props
 */
export default function GrillaMesTitularCalendario({ anio, mes, diasMap, gruposEquipo, onDiaClick }) {
  const map = diasMap && typeof diasMap === "object" ? diasMap : {};

  const grupos = useMemo(
    () => extraerGruposDesdeVis(map, gruposEquipo),
    [map, gruposEquipo],
  );

  const esMultiGrupo = grupos.length >= 2;

  if (!esMultiGrupo) {
    return (
      <CalendarioGrupo
        anio={anio}
        mes={mes}
        diasMap={map}
        gdtId={grupos[0]?.gdtId || ""}
        etiqueta={grupos[0]?.etiqueta || ""}
        esMultiGrupo={false}
        grupos={grupos}
        onDiaClick={onDiaClick}
      />
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {grupos.map((g) => (
        <CalendarioGrupo
          key={g.gdtId}
          anio={anio}
          mes={mes}
          diasMap={map}
          gdtId={g.gdtId}
          etiqueta={g.etiqueta}
          esMultiGrupo={true}
          grupos={grupos}
          onDiaClick={onDiaClick}
        />
      ))}
    </div>
  );
}
