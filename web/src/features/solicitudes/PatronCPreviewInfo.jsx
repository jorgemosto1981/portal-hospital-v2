import { TICKETERA } from "./ticketeraUi.js";

export default function PatronCPreviewInfo({ preview }) {
  if (!preview) return null;

  const eligible = preview.eligible === true || preview.ok === true;
  const checks = Array.isArray(preview.checks) ? preview.checks : [];
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const saldo = preview.saldo_global || {};
  const mensajes = Array.isArray(preview.mensajes) ? preview.mensajes.filter(Boolean) : [];

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg p-3 ${
          eligible ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
        }`}
      >
        <p className="text-sm font-semibold">
          {eligible ? "Solicitud elegible" : "Solicitud no elegible"}
        </p>
        {!eligible && mensajes.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-xs">
            {mensajes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {eligible && saldo.saldo_disponible != null ? (
        <div className={`${TICKETERA.card} ${TICKETERA.cardPad}`}>
          <p className="text-xs font-medium text-slate-600">Saldo cuenta corriente</p>
          <div className="mt-1 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{saldo.saldo_disponible ?? "–"}</p>
              <p className="text-xs text-slate-500">Disponible (hs)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-violet-700">{saldo.cantidad_consumo ?? "–"}</p>
              <p className="text-xs text-slate-500">Solicitado (hs)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700">{saldo.saldo_restante_preview ?? "–"}</p>
              <p className="text-xs text-slate-500">Restante (hs)</p>
            </div>
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">Advertencias</p>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
            {warnings.map((w, i) => (
              <li key={i}>{w.copy || w.codigo || JSON.stringify(w)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {checks.length > 0 ? (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Detalle de checks ({checks.length})</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {checks.map((c, i) => (
              <li key={i} className={c.nivel === "bloqueante" ? "text-red-600" : ""}>
                [{c.fase}] {c.codigo} — {c.detalle}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
