const TABS = [
  { id: "A", label: "LAO Disponibles", hint: "Patrón A" },
  { id: "B", label: "Ciclos anuales", hint: "Patrón B" },
  { id: "C", label: "Cuenta continua", hint: "Patrón C" },
];

/** @param {{ active: 'A'|'B'|'C', onChange: (id: 'A'|'B'|'C') => void, disabled?: boolean }} */
export function CheckinCategoriaTabs({ active, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Categoría de saldo</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(tab.id)}
              className={[
                "min-h-11 touch-manipulation rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                isActive
                  ? "border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white text-slate-700 active:bg-slate-50",
                disabled ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="block font-semibold">{tab.label}</span>
              <span className="block text-xs text-slate-500">{tab.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}