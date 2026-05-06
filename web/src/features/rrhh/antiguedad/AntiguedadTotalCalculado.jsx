import { formatoAmdLegible } from "./amdFormat.js";

export function AntiguedadTotalCalculado({ resultado }) {
  return (
    <div className="mt-2 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3 print:bg-white">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total calculado</p>
      <p className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
        {formatoAmdLegible({
          años: resultado.años,
          meses: resultado.meses,
          dias: resultado.dias,
        })}
      </p>
      <p className="mt-2 text-sm font-normal text-slate-500 md:text-base">
        <span className="text-slate-500">Equiv. referencial (365/30): </span>
        <span className="tabular-nums text-slate-600">{resultado.totalDiasCalculados}</span>
        <span className="text-slate-500"> días · dato complementario</span>
      </p>
      <p className="mt-2 border-t border-blue-100/80 pt-2 text-[11px] text-slate-600">
        La cifra principal del cómputo es el desglose en años, meses y días. Los días totales sirven como referencia
        para cruzar con otros módulos.
      </p>
    </div>
  );
}
