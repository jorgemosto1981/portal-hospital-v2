import { diasAAniosMesesDias } from "./amdFormat.js";
import { formatDdMmAaaa } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";
import { TimelineHlcFusionados } from "./TimelineHlcFusionados.jsx";

export function AntiguedadIntervalosFusionadosSection({ intervalos, fechaCorteIso, detalleKey }) {
  if (!intervalos?.length) return null;
  return (
    <details
      key={`fus-${detalleKey}`}
      className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 print:break-inside-avoid"
      open
    >
      <summary className="flex cursor-pointer touch-manipulation list-none items-center gap-2 text-xs font-semibold text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <MarcadorInline className="text-emerald-700">◇</MarcadorInline>
        <span>Intervalos HLC fusionados</span>
      </summary>
      <TimelineHlcFusionados intervalos={intervalos} fechaCorteIso={fechaCorteIso || ""} />
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {intervalos.map((item, idx) => (
          <li key={`fused-${idx}`} className="rounded-lg border border-emerald-100 bg-white px-2 py-2">
            {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin)} · ${item.dias} días · ${diasAAniosMesesDias(item.dias)}`}
          </li>
        ))}
      </ul>
    </details>
  );
}
