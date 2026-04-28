export default function FormHeaderControls({
  tipo,
  setTipo,
  modoEdicion,
  setModoEdicion,
  setEditId,
  registros,
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={modoEdicion}
            onChange={(e) => {
              const checked = e.target.checked;
              setModoEdicion(checked);
              setEditId("");
              if (!checked) return;
              const first = registros[0];
              if (first && first.id) {
                setEditId(String(first.id));
                hydrateFrom(first);
              }
            }}
          />
          Editar existente
        </label>
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
            {registros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
