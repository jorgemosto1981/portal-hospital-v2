import { formatDdMmAaaa } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";

export function AntiguedadHlcExcluidasNoComputaSection({ items }) {
  if (!items?.length) return null;

  return (
    <details className="mt-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3 print:break-inside-avoid" open>
      <summary className="flex cursor-pointer touch-manipulation list-none items-center gap-2 text-xs font-semibold text-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <MarcadorInline className="text-amber-800">•</MarcadorInline>
        <span>HLC excluidas del cómputo por configuración "No computa antigüedad para licencias" ({items.length})</span>
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-slate-700">
        {items.map((item, idx) => (
          <li key={`hlc-excl-${idx}`} className="rounded-lg border border-amber-200 bg-white px-2 py-2">
            <p className="font-medium text-slate-800">
              {item.hlc_id || "HLC sin ID"} · {item.cargo_funcional_id || "cargo —"} · {item.efector_cumplimiento_id || "efector —"}
            </p>
            <p className="mt-1">
              {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin)} · No incluida por estar configurada en "No computa antigüedad para licencias".`}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
