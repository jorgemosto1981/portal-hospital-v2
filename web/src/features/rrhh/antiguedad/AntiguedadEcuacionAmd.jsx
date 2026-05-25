import { detectarAcarreo } from "./acarreo.js";
import { TarjetaAmdPaso } from "./TarjetaAmdPaso.jsx";

export function AntiguedadEcuacionAmd({ detalleCalculo }) {
  if (!detalleCalculo?.amdHlc || !detalleCalculo?.amdFinal) return null;

  const raw = detalleCalculo.amdExternoSumadoRaw;
  const tieneExterno =
    raw && (raw.años > 0 || raw.meses > 0 || raw.dias > 0) ? raw : null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-800">Ecuación del cómputo (A/M/D)</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Suma directa tras validar fechas; sin cruzar fechas del externo con períodos HLC.
      </p>
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-2">
        <div className="min-w-0 flex-1">
          <TarjetaAmdPaso titulo="Solo HLC (365/30)" amd={detalleCalculo.amdHlc} className="border-slate-200 bg-slate-50/90" />
        </div>
        <div className="flex items-center justify-center py-1 md:w-10 md:py-0">
          <span className="text-lg font-bold leading-none text-slate-400" aria-hidden="true">
            +
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <TarjetaAmdPaso
            titulo="Crédito externo sumado"
            amd={tieneExterno}
            pie="0 (sin reconocimiento aplicado)"
            className="border-sky-100 bg-sky-50/80"
          />
        </div>
        <div className="flex items-center justify-center py-1 md:w-10 md:py-0">
          <span className="text-lg font-bold leading-none text-slate-400" aria-hidden="true">
            =
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <TarjetaAmdPaso titulo="Total (tras acarreo)" amd={detalleCalculo.amdFinal} className="border-blue-200 bg-blue-50/90" />
        </div>
      </div>
      <AcarreoChip detalleCalculo={detalleCalculo} />
    </div>
  );
}

function AcarreoChip({ detalleCalculo }) {
  const ac = detectarAcarreo(detalleCalculo);
  if (!ac.hubo || !ac.antes) return null;
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 print:break-inside-avoid">
      <span className="mt-0.5 shrink-0 rounded-md bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
        Acarreo aplicado
      </span>
      <p className="min-w-0 leading-relaxed">
        Suma cruda (HLC + externo) antes de normalizar:{" "}
        <span className="font-mono font-semibold">
          {ac.antes.años}a {ac.antes.meses}m {ac.antes.dias}d
        </span>
        {" → "}
        <span className="font-mono font-semibold">
          {ac.despues.años}a {ac.despues.meses}m {ac.despues.dias}d
        </span>
        . Reglas: días &gt; 29 → +1 mes (−30); meses &gt; 11 → +1 año (−12).
      </p>
    </div>
  );
}
