/** @param {{ modo: 'nuevo' | 'rectificacion' | null, onSelect: (m: 'nuevo' | 'rectificacion') => void, disabled?: boolean }} */
export function CheckinModoSelector({ modo, onSelect, disabled }) {
  const base =
    "min-h-11 touch-manipulation rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50";

  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <p className="text-sm font-semibold text-violet-950">Este agente ya tiene check-in previo</p>
      <p className="text-xs leading-relaxed text-violet-900/90">
        Elegí <strong>check-in nuevo</strong> (primera carga) o <strong>rectificación</strong> (corregir solo las bolsas
        que guardés (LAO, art. 64, etc.); no revalida HLC ni licencias; no altera otros artículos).
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect("nuevo")}
          className={[
            base,
            modo === "nuevo"
              ? "border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-200"
              : "border-slate-200 bg-white text-slate-800",
          ].join(" ")}
        >
          <span className="block font-semibold">Check-in nuevo</span>
          <span className="block text-xs text-slate-600">Primera fotografía de saldos</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect("rectificacion")}
          className={[
            base,
            modo === "rectificacion"
              ? "border-violet-500 bg-violet-100 text-violet-950 ring-1 ring-violet-300"
              : "border-slate-200 bg-white text-slate-800",
          ].join(" ")}
        >
          <span className="block font-semibold">Rectificación</span>
          <span className="block text-xs text-slate-600">Solo bolsas que actualices acá</span>
        </button>
      </div>
    </div>
  );
}
