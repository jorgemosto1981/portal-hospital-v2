/**
 * Combobox de una persona (agente) con búsqueda por nombre, DNI o id.
 * Estado controlado desde el hook de la página (lista, query, open).
 */
export function PersonaAgenteCombobox({
  personaWrapRef,
  loadPersonas,
  personaOpen,
  setPersonaOpen,
  personaQuery,
  setPersonaQuery,
  personaId,
  setPersonaId,
  personaSeleccionadaLabel,
  personaOptionsFiltradas,
  placeholderEmpty = "Seleccionar agente activo…",
  emptyListMessage = "Sin agentes activos que coincidan.",
  showSelectedId = true,
}) {
  return (
    <div ref={personaWrapRef} className="relative text-sm text-slate-700">
      <label className="block text-xs font-semibold tracking-wide text-slate-600">
        <span className="uppercase">Agente</span>
        <span className="ml-1 text-[11px] font-normal text-slate-500">(persona_id)</span>
      </label>
      <input
        value={personaOpen ? personaQuery : personaSeleccionadaLabel}
        onFocus={() => {
          setPersonaOpen(true);
          setPersonaQuery("");
        }}
        onChange={(e) => {
          setPersonaOpen(true);
          setPersonaQuery(e.target.value);
        }}
        placeholder={personaId ? "Buscar por nombre, DNI o ID…" : placeholderEmpty}
        className="mt-1 min-h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none ring-blue-600 focus-visible:ring-2"
        disabled={loadPersonas}
        autoComplete="off"
        aria-expanded={personaOpen}
        aria-haspopup="listbox"
      />
      {showSelectedId && personaId && !personaOpen ? (
        <p className="mt-1.5 break-all font-mono text-[11px] text-slate-600">
          <span className="font-sans font-medium text-slate-500">ID seleccionado: </span>
          {personaId}
        </p>
      ) : null}
      {personaOpen ? (
        <div
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          <button
            type="button"
            onClick={() => {
              setPersonaId("");
              setPersonaQuery("");
              setPersonaOpen(false);
            }}
            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-500 active:bg-slate-50"
          >
            Limpiar selección…
          </button>
          {personaOptionsFiltradas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">{emptyListMessage}</p>
          ) : (
            personaOptionsFiltradas.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={personaId === o.value}
                onClick={() => {
                  setPersonaId(o.value);
                  setPersonaQuery("");
                  setPersonaOpen(false);
                }}
                className={[
                  "block w-full px-3 py-2 text-left text-sm active:bg-blue-50",
                  personaId === o.value ? "bg-blue-50 text-blue-900" : "text-slate-700",
                ].join(" ")}
              >
                <span className="block">{o.label}</span>
                <span className="block font-mono text-[11px] text-slate-500">{o.value}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
