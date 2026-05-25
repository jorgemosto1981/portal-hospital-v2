import { catalogLabel, diasAAniosMesesDias } from "./amdFormat.js";
import { formatDdMmAaaa } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";

export function AntiguedadHlcConsideradasSection({
  items,
  detalleKey,
  hlcConsideradasCount,
  idxEscalafon,
  idxAgrupamiento,
  idxTipoVinculo,
}) {
  if (!items?.length) return null;
  return (
    <details
      key={`hlc-${detalleKey}`}
      className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 print:break-inside-avoid"
      open={hlcConsideradasCount <= 2}
    >
      <summary className="flex cursor-pointer touch-manipulation list-none items-center gap-2 text-xs font-semibold text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <MarcadorInline className="text-indigo-700">•</MarcadorInline>
        <span>
          HLC consideradas ({hlcConsideradasCount})
          {hlcConsideradasCount > 2 ? <span className="font-normal text-indigo-600"> — expandir lista</span> : null}
        </span>
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {items.map((item, idx) => (
          <li key={`hlc-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
            <p className="text-xs text-slate-700">
              {`${catalogLabel(idxEscalafon.get(String(item.escalafon_id || ""))) || item.escalafon_id || "Escalafón —"} · ${
                catalogLabel(idxAgrupamiento.get(String(item.agrupamiento_id || ""))) || item.agrupamiento_id || "Agrupamiento —"
              } · ${catalogLabel(idxTipoVinculo.get(String(item.tipo_vinculo_id || ""))) || item.tipo_vinculo_id || "Tipo de vínculo —"}`}
            </p>
            <p className="mt-1 pl-2 text-xs text-slate-600">
              {`${formatDdMmAaaa(item.fecha_inicio)} a ${formatDdMmAaaa(item.fecha_fin_topada)} · ${item.dias} días · ${diasAAniosMesesDias(item.dias)}`}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
