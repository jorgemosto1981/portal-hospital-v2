import { useMemo } from "react";

import { MS_DIA } from "./constants.js";
import { formatDdMmAaaa, parseIsoYmdToUtcMs } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";

export function TimelineHlcFusionados({ intervalos, fechaCorteIso }) {
  const layout = useMemo(() => {
    if (!intervalos?.length) return null;
    const rows = intervalos.map((it, idx) => {
      const start = parseIsoYmdToUtcMs(it.fecha_inicio);
      const end = parseIsoYmdToUtcMs(it.fecha_fin);
      return {
        idx,
        start,
        end,
        dias: it.dias,
        labelIni: formatDdMmAaaa(it.fecha_inicio),
        labelFin: formatDdMmAaaa(it.fecha_fin),
        ok: Number.isFinite(start) && Number.isFinite(end) && end >= start,
      };
    });
    const valid = rows.filter((r) => r.ok);
    if (!valid.length) return null;
    const corteMs = fechaCorteIso ? parseIsoYmdToUtcMs(fechaCorteIso) : NaN;
    let minT = Math.min(...valid.map((r) => r.start));
    let maxT = Math.max(...valid.map((r) => r.end));
    if (Number.isFinite(corteMs)) maxT = Math.max(maxT, corteMs);
    const span = Math.max(MS_DIA, maxT - minT);
    return { valid, minT, maxT, span, corteMs };
  }, [intervalos, fechaCorteIso]);

  if (!layout) return null;
  const { valid, minT, span, corteMs } = layout;

  return (
    <div className="mt-2 rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-3 py-3 print:break-inside-avoid">
      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <MarcadorInline className="text-emerald-700">■</MarcadorInline>
        Línea de tiempo (HLC fusionados)
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Escala relativa entre el inicio del primer tramo y el fin del corte. Cada barra es un intervalo ya fusionado.
      </p>
      <div className="relative mt-3 h-14 rounded-lg bg-white/90 px-1 ring-1 ring-emerald-100 print:bg-white">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-200" aria-hidden />
        {valid.map((r) => {
          const leftPct = ((r.start - minT) / span) * 100;
          const wPct = Math.max(0.8, ((r.end - r.start + MS_DIA) / span) * 100);
          return (
            <div
              key={`tl-${r.idx}`}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${leftPct}%`, width: `${wPct}%`, minWidth: "4px" }}
            >
              <span
                className="h-8 w-full min-w-[6px] rounded-t-md bg-emerald-500/90 print:bg-emerald-600"
                title={`${r.labelIni} → ${r.labelFin} · ${r.dias} días`}
              />
              <span className="mt-0.5 max-w-full truncate px-0.5 text-center text-[9px] font-medium text-slate-600 print:text-slate-800">
                {r.dias}d
              </span>
            </div>
          );
        })}
        {Number.isFinite(corteMs) ? (
          <div
            className="absolute bottom-0 top-0 z-10 w-px bg-amber-500 print:bg-amber-600"
            style={{ left: `${((corteMs - minT) / span) * 100}%` }}
            title={`Corte ${formatDdMmAaaa(fechaCorteIso)}`}
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-1 text-[10px] text-slate-500 print:text-slate-700">
        {(() => {
          const sorted = [...valid].sort((a, b) => a.start - b.start);
          const ini = sorted[0];
          const fin = sorted[sorted.length - 1];
          return (
            <>
              <span>{ini ? ini.labelIni : "—"}</span>
              <span>
                Corte: {formatDdMmAaaa(fechaCorteIso)} {Number.isFinite(corteMs) ? "(línea ámbar)" : ""}
              </span>
              <span>{fin ? fin.labelFin : "—"}</span>
            </>
          );
        })()}
      </div>
    </div>
  );
}
