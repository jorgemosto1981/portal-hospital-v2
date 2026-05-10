/**
 * Lista ordenada de pasos → cfg_paso_workflow_articulo (`paso_workflow_articulo_ids`).
 */
export default function OrderedPasosWorkflow({
  pasoIds,
  catalogoPaso,
  onChange,
}) {
  const ids = Array.isArray(pasoIds) ? pasoIds.map(String) : [];

  const options =
    catalogoPaso?.status === "ok" && Array.isArray(catalogoPaso.options)
      ? catalogoPaso.options
      : [];

  const setIds = (next) => {
    onChange(next.length ? next : undefined);
  };

  const agregar = () => {
    const primeraLibre = options.find((o) => !ids.includes(o.value));
    if (!primeraLibre) return;
    setIds([...ids, primeraLibre.value]);
  };

  const mover = (index, delta) => {
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    const t = next[index];
    next[index] = next[j];
    next[j] = t;
    setIds(next);
  };

  const quitar = (index) => {
    const next = ids.filter((_, i) => i !== index);
    setIds(next);
  };

  const cambiarPaso = (index, nuevoId) => {
    const v = String(nuevoId || "").trim();
    if (!v) {
      quitar(index);
      return;
    }
    const next = [...ids];
    next[index] = v;
    setIds(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        El orden define la secuencia sugerida para el trámite. Los booleans legacy del workflow siguen
        aplicando hasta migración completa a pasos.
      </p>
      {catalogoPaso?.status === "loading" ? (
        <p className="text-sm text-slate-500">Cargando pasos…</p>
      ) : catalogoPaso?.status === "error" ? (
        <p className="text-sm text-red-700">{catalogoPaso.error}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-amber-800">No hay filas en cfg_paso_workflow_articulo.</p>
      ) : (
        <ul className="space-y-2">
          {ids.map((idVal, index) => (
            <li
              key={`${idVal}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
            >
              <span className="w-8 shrink-0 text-center text-xs font-semibold text-slate-500">
                {index + 1}.
              </span>
              <select
                value={idVal}
                onChange={(e) => cambiarPaso(index, e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => mover(index, -1)}
                disabled={index === 0}
                className="min-h-11 min-w-[2.75rem] touch-manipulation rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-100 disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(index, 1)}
                disabled={index >= ids.length - 1}
                className="min-h-11 min-w-[2.75rem] touch-manipulation rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-100 disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => quitar(index)}
                className="min-h-11 touch-manipulation rounded-lg border border-red-200 bg-red-50 px-3 text-sm text-red-900 outline-none ring-red-500 focus-visible:ring-2 active:bg-red-100"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={agregar}
        disabled={catalogoPaso?.status !== "ok" || options.length === 0}
        className="min-h-11 touch-manipulation rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 outline-none ring-blue-500 focus-visible:ring-2 active:bg-blue-100 disabled:opacity-40"
      >
        Agregar paso
      </button>
    </div>
  );
}
