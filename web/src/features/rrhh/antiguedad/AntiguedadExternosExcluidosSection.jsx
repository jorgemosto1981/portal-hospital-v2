import { formatDdMmAaaa } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";

export function AntiguedadExternosExcluidosSection({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 print:break-inside-avoid">
      <p className="flex items-center gap-2 text-xs font-semibold text-amber-900">
        <MarcadorInline className="text-amber-700">!</MarcadorInline>
        Crédito externo no aplicado por fecha
      </p>
      <ul className="mt-1 space-y-1 text-xs text-amber-700">
        {items.map((rec, idx) => (
          <li key={`ext-skip-${idx}`} className="rounded-lg border border-amber-200 bg-white px-2 py-2">
            {`${rec?.detalle?.normativa || "Sin normativa"} · Desde ${formatDdMmAaaa(rec?.detalle?.fecha_impacto || "")} · No aplicado: ${rec?.motivo || "fuera de corte"}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
