import { useMemo } from "react";

import {
  TIPOS_EVENTO_CALENDARIO,
  colorClassPorTipoEvento,
} from "../../constants/calendarioInstitucional.js";
import { esFinDeSemanaYmd, resolverEventoEnIndice } from "../../services/calendarioInstitucionalService.js";
import {
  DIAS_SEMANA_CAL,
  celdasMesCalendario,
  colorClassSinHover,
} from "./calendarioMesUi.js";

/**
 * Grilla mes calendario institucional.
 * @param {{
 *   year: number,
 *   month: number,
 *   indice: Map<string, unknown> | Record<string, unknown>,
 *   interactive?: boolean,
 *   onDayClick?: (ymd: string) => void,
 * }} props
 */
export function CalendarioMesGrilla({ year, month, indice, interactive = false, onDayClick }) {
  const celdas = useMemo(() => celdasMesCalendario(year, month), [year, month]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-600">
        {DIAS_SEMANA_CAL.map((d, i) => (
          <div key={`dow-h-${i}`} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((ymd, idx) => {
          if (!ymd) {
            return <div key={`pad-${idx}`} className="min-h-[3rem] rounded bg-slate-50/50" />;
          }
          const ev = resolverEventoEnIndice(ymd, indice);
          const finde = esFinDeSemanaYmd(ymd);
          const colorRaw = ev
            ? colorClassPorTipoEvento(ev.tipo)
            : finde
              ? "bg-slate-200/80 text-slate-600"
              : "bg-white";
          const color = interactive
            ? ev
              ? colorClassPorTipoEvento(ev.tipo)
              : finde
                ? "bg-slate-200/80 text-slate-600 hover:bg-slate-300/80"
                : "bg-white hover:bg-slate-50"
            : colorClassSinHover(colorRaw);
          const dayNum = Number(ymd.slice(8, 10));
          const common = `min-h-[3rem] rounded border border-slate-200 text-sm font-medium text-slate-800 ${color}`;
          const title = ev?.descripcion || ymd;

          if (interactive && typeof onDayClick === "function") {
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => onDayClick(ymd)}
                className={`${common} touch-manipulation active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                title={title}
              >
                {dayNum}
              </button>
            );
          }

          return (
            <div key={ymd} className={`${common} flex items-center justify-center`} title={title}>
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeyendaCalendarioInstitucional() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-6 rounded bg-slate-200" />
        Fin de semana (no hábil)
      </span>
      {TIPOS_EVENTO_CALENDARIO.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1">
          <span className={`inline-block h-3 w-6 rounded ${colorClassSinHover(t.colorClass)}`} />
          {t.label}
        </span>
      ))}
    </div>
  );
}
