export default function FormHeaderControls({
  tipo,
  setTipo,
  personaId,
  setPersonaId,
  personaOptions,
  showPersonaSelector = true,
  modoEdicion,
  setModoEdicion,
  setEditId,
  registros,
  registrosOptions,
  hydrateFrom,
  editId,
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Colección</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="personas">personas</option>
            <option value="formacion_agente">formacion_agente</option>
            <option value="declaraciones_grupo_familiar">declaraciones_grupo_familiar</option>
            <option value="consentimientos">consentimientos</option>
          </select>
        </div>
        {showPersonaSelector ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              persona_id (filtro de edición)
            </label>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
            >
              <option value="">Seleccionar persona...</option>
              {(personaOptions || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">persona_id</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{personaId || "sin persona vinculada"}</p>
          </div>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={modoEdicion}
            onChange={(e) => {
              const checked = e.target.checked;
              setModoEdicion(checked);
              setEditId("");
              if (!checked) return;
              const first = (registros || [])[0];
              if (first && first.id) {
                setEditId(String(first.id));
                hydrateFrom(first);
              }
            }}
          />
          Editar existente
        </label>
        {modoEdicion && !personaId ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Seleccioná primero un <span className="font-semibold">persona_id</span> para listar registros a editar.
          </p>
        ) : null}
      </div>

      {modoEdicion && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Registro</label>
          <select
            value={editId}
            onChange={(e) => {
              const id = e.target.value;
              setEditId(id);
              const item = registros.find((x) => String(x.id) === String(id));
              if (item) hydrateFrom(item);
            }}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="">Seleccionar registro...</option>
            {(registrosOptions || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
