export function CheckinArticuloTabs({ articulos, loading, articuloId, onSelect }) {
  if (loading) {
    return <p className="text-sm text-slate-500">Cargando artículos vigentes…</p>;
  }
  if (!articulos.length) {
    return <p className="text-sm text-slate-500">No hay artículos activos en el configurador.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Artículo</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {articulos.map((a) => {
          const active = articuloId === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className={[
                "min-h-11 shrink-0 touch-manipulation rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "border-blue-300 bg-blue-50 text-blue-900 ring-1 ring-blue-200"
                  : "border-slate-200 bg-white text-slate-700 active:bg-slate-50",
              ].join(" ")}
            >
              <span className="block font-semibold">{a.codigo}</span>
              <span className="block max-w-[10rem] truncate text-xs text-slate-500">{a.nombre || a.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
