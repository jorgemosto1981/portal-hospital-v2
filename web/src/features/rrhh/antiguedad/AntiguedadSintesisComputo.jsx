import { amdLegibleDesdeDias, amdLegibleDesdeReconocimiento, formatoAmdLegible } from "./amdFormat.js";
import { formatDdMmAaaa } from "./dateIso.js";

export function AntiguedadSintesisComputo({ resultado }) {
  const det = resultado?.detalleCalculo;
  const fcIso = det?.fechaCorteAplicada || "";
  const fcDdMm = formatDdMmAaaa(fcIso);
  const diasHlc = Number(det?.resumen?.diasHlcFusionados ?? 0);
  const amdHlc =
    det?.amdHlc && typeof det.amdHlc === "object" ? formatoAmdLegible(det.amdHlc) : amdLegibleDesdeDias(diasHlc);
  const amdTotal = formatoAmdLegible({
    años: resultado.años,
    meses: resultado.meses,
    dias: resultado.dias,
  });
  const aplicados = det?.externosConsiderados || [];
  const excl = det?.externosExcluidosPorCorte || [];

  if (aplicados.length > 0) {
    return (
      <div className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs leading-relaxed text-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Síntesis del cómputo (crédito externo)</p>
        {aplicados.map((rec, idx) => {
          const fiDdMm = formatDdMmAaaa(rec?.fecha_impacto || "");
          const saldoRec = amdLegibleDesdeReconocimiento(rec);
          return (
            <p key={`sint-aplica-${idx}`} className="mt-2">
              Por ser la fecha de cálculo (<span className="font-semibold">{fcDdMm}</span>) igual o posterior a la fecha de
              implementación del reconocimiento (<span className="font-semibold">{fiDdMm}</span>), se suman al desglose HLC los{" "}
              <span className="font-semibold">{saldoRec}</span> del reconocimiento (años/meses/días), aplicando acarreo si
              corresponde, resultando la antigüedad total <span className="font-semibold">{amdTotal}</span>.
            </p>
          );
        })}
      </div>
    );
  }
  if (excl.length > 0) {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-3 text-xs leading-relaxed text-amber-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
          Síntesis del cómputo (crédito externo no incorporado)
        </p>
        {excl.map((row, idx) => {
          const fiDdMm = formatDdMmAaaa(row?.detalle?.fecha_impacto || "");
          const saldoRec = amdLegibleDesdeReconocimiento(row?.detalle || {});
          return (
            <p key={`sint-no-${idx}`} className="mt-2">
              Por ser la fecha de cálculo (<span className="font-semibold">{fcDdMm}</span>) anterior a la fecha de
              implementación del reconocimiento (<span className="font-semibold">{fiDdMm}</span>),{" "}
              <span className="font-semibold">no</span> se suma el saldo de <span className="font-semibold">{saldoRec}</span>.
              La antigüedad queda entonces en <span className="font-semibold">{amdHlc}</span> (solo HLC), equivalente al total
              mostrado: <span className="font-semibold">{amdTotal}</span>.
            </p>
          );
        })}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Síntesis del cómputo</p>
      <p className="mt-2">
        No interviene reconocimiento de antigüedad externa en este resultado. La antigüedad corresponde al cálculo por HLC:{" "}
        <span className="font-semibold">{amdHlc}</span> (total: <span className="font-semibold">{amdTotal}</span>).
      </p>
    </div>
  );
}
