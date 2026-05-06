import { formatoAmdLegible } from "./amdFormat.js";

/** Tarjeta A/M/D para lectura rápida (móvil primero). */
export function TarjetaAmdPaso({ titulo, amd, pie, className = "" }) {
  const tiene = amd && typeof amd === "object";
  const a = tiene ? Math.max(0, Number(amd.años ?? amd.anios ?? 0)) : null;
  const m = tiene ? Math.max(0, Number(amd.meses ?? 0)) : null;
  const d = tiene ? Math.max(0, Number(amd.dias ?? 0)) : null;
  return (
    <div
      className={`rounded-xl border px-3 py-3 shadow-sm ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      {tiene ? (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {a}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">a</span>
            </span>
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {m}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">m</span>
            </span>
            <span className="inline-flex min-h-9 min-w-[2.75rem] items-center justify-center rounded-lg bg-white/80 px-2 text-sm font-bold tabular-nums text-slate-900 ring-1 ring-slate-200/80">
              {d}
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">d</span>
            </span>
          </div>
          <p className="mt-2 text-xs leading-snug text-slate-600">{formatoAmdLegible(amd)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{pie || "—"}</p>
      )}
    </div>
  );
}
