import { formatoAmdLegible } from "./amdFormat.js";

export function AntiguedadCreditoExternoResumen({ detalleCalculo }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      {detalleCalculo?.amdExternoSumadoRaw ? (
        <p>
          <span className="font-semibold text-slate-800">Suma crédito externo (A/M/D)</span>:{" "}
          <span className="font-semibold text-slate-900">{formatoAmdLegible(detalleCalculo.amdExternoSumadoRaw)}</span>
          <span className="text-slate-600">
            {" "}
            · Equiv. referencial en días (365/30): {detalleCalculo?.diasExternosAplicados ?? 0} días
          </span>
        </p>
      ) : (
        <p>
          <span className="font-semibold text-slate-800">Crédito externo</span>
          <span className="text-slate-600">: no aplica en este resultado.</span>
        </p>
      )}
      <p className="mt-1 text-slate-600">
        El resultado final en años/meses/días combina HLC + externo y aplica acarreo (días &gt; 29 → mes; meses &gt; 11 → año).
      </p>
    </div>
  );
}
