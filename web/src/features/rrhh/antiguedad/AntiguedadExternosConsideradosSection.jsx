import { formatDdMmAaaa } from "./dateIso.js";
import { MarcadorInline } from "./MarcadorInline.jsx";

export function AntiguedadExternosConsideradosSection({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3 print:break-inside-avoid">
      <p className="flex items-center gap-2 text-xs font-semibold text-sky-800">
        <MarcadorInline className="text-emerald-600">✓</MarcadorInline>
        Decisión de aplicación del crédito externo
      </p>
      <ul className="mt-1 space-y-1 text-xs text-slate-600">
        {items.map((rec, idx) => (
          <li key={`ext-ok-${idx}`} className="rounded-lg border border-sky-100 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Aplica
              </span>
              <span className="text-xs font-semibold text-slate-800">{rec?.normativa || "Sin normativa"}</span>
            </div>
            <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Aporte A/M/D</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {rec?.amd_aportado
                    ? `${rec.amd_aportado.años} / ${rec.amd_aportado.meses} / ${rec.amd_aportado.dias}`
                    : `${Number(rec?.anios || 0)} / ${Number(rec?.meses || 0)} / ${Number(rec?.dias_desglose_normativo ?? rec?.dias ?? 0)}`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Implementación</dt>
                <dd className="font-medium text-slate-800">{formatDdMmAaaa(rec?.fecha_impacto || "")}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Equiv. días (referencia 365/30)</dt>
                <dd className="font-medium text-slate-800">{rec?.dias_netos_aplicados ?? rec?.dias_reconocidos ?? 0}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
