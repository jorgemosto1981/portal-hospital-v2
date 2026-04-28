export default function DdjjFields({
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  HELP,
  modoEdicion,
  form,
  nextDeclaracionVersion,
  setFamiliares,
  emptyFamiliar,
  familiares,
  optsParentesco,
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">estado_declaracion_id (fijo)</label>
        <input
          value={ESTADO_DDJJ_DEFAULT_PERSONALES}
          disabled
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.estado_declaracion_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">declaracion_version (automática)</label>
        <input
          value={modoEdicion ? form.declaracion_version : nextDeclaracionVersion}
          disabled
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.declaracion_version}</p>
      </div>
      <p className="md:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        `declaracion_jurada_aceptada` y `aceptada_en` no se cargan manualmente en esta pantalla.
        Se resuelven por el flujo de validación/aceptación posterior según el estado DDJJ.
      </p>

      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Familiares declarados</p>
          <button
            type="button"
            onClick={() => setFamiliares((prev) => [...prev, emptyFamiliar()])}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            Agregar familiar
          </button>
        </div>
        <div className="space-y-3">
          {familiares.map((f, idx) => (
            <div key={`fam-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Familiar {idx + 1}
                </p>
                {familiares.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setFamiliares((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-xs font-semibold text-rose-600"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">parentesco_id</label>
                  <select
                    value={f.parentesco_id}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, parentesco_id: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="">Seleccionar...</option>
                    {optsParentesco.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">dni</label>
                  <input
                    value={f.dni}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, dni: e.target.value } : x)),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">nombre</label>
                  <input
                    value={f.nombre}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">apellido</label>
                  <input
                    value={f.apellido}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, apellido: e.target.value } : x)),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">fecha_nacimiento</label>
                  <input
                    type="date"
                    value={f.fecha_nacimiento}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, fecha_nacimiento: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">notas_titular</label>
                  <input
                    value={f.notas_titular}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, notas_titular: e.target.value } : x,
                        ),
                      )
                    }
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.convive}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, convive: e.target.checked } : x)),
                      )
                    }
                  />
                  Convive
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.dependiente}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, dependiente: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  Dependiente
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.discapacidad_declarada}
                    onChange={(e) =>
                      setFamiliares((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, discapacidad_declarada: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  Discapacidad declarada
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
