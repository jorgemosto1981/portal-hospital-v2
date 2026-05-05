export default function FormacionFields({
  form,
  setField,
  disabled = false,
  HELP,
  optsNivel,
  optsEspecialidad,
  optsColegio,
  optsJurisdiccionMatricula,
}) {
  function labelWithId(label, id) {
    return (
      <span>
        {label} <span className="text-xs italic text-slate-500">({id})</span>
      </span>
    );
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Nivel de estudios", "nivel_estudios_id")}</label>
        <select value={form.nivel_estudios_id} onChange={(e) => setField("nivel_estudios_id", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500">
          <option value="">Seleccionar...</option>
          {optsNivel.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.nivel_estudios_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Título completo", "titulo_completo")}</label>
        <input value={form.titulo_completo} onChange={(e) => setField("titulo_completo", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500" />
        <p className="mt-1 text-xs text-slate-500">{HELP.titulo_completo}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Duración (años)", "duracion_anios")}</label>
        <input value={form.duracion_anios} onChange={(e) => setField("duracion_anios", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500" />
        <p className="mt-1 text-xs text-slate-500">{HELP.duracion_anios}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Institución", "institucion")}</label>
        <input value={form.institucion} onChange={(e) => setField("institucion", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500" />
        <p className="mt-1 text-xs text-slate-500">{HELP.institucion}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Nro de matrícula", "matricula_numero")}</label>
        <input value={form.matricula_numero} onChange={(e) => setField("matricula_numero", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500" />
        <p className="mt-1 text-xs text-slate-500">{HELP.matricula_numero}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Especialidad", "especialidad_id")}</label>
        <select value={form.especialidad_id} onChange={(e) => setField("especialidad_id", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500">
          <option value="">Seleccionar...</option>
          {optsEspecialidad.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.especialidad_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Colegio", "colegio_id")}</label>
        <select value={form.colegio_id} onChange={(e) => setField("colegio_id", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500">
          <option value="">Seleccionar...</option>
          {optsColegio.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.colegio_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">{labelWithId("Jurisdicción de matrícula", "matricula_jurisdiccion_id")}</label>
        <select value={form.matricula_jurisdiccion_id} onChange={(e) => setField("matricula_jurisdiccion_id", e.target.value)} disabled={disabled} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500">
          <option value="">Seleccionar...</option>
          {optsJurisdiccionMatricula.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.matricula_jurisdiccion_id}</p>
      </div>
    </>
  );
}
