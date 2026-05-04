export default function DdjjFields({
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  estadoDeclaracionIdActual,
  estadoDeclaracionUiLabel,
  HELP,
  modoEdicion,
  form,
  nextDeclaracionVersion,
  setFamiliares,
  emptyFamiliar,
  familiares,
  optsParentesco,
  disabled = false,
}) {
  const PARENTESCO_OTROS_ID = "CFG_PAR_OTROS";

  function updateFam(idx, key, value) {
    setFamiliares((prev) => prev.map((x, i) => (i === idx ? { ...x, [key]: value } : x)));
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">estado_declaracion_id (vista simplificada)</label>
        <input
          value={estadoDeclaracionUiLabel || "Pendiente de presentación"}
          disabled
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
        />
        <p className="mt-1 text-[11px] italic text-slate-500">
          ({String(estadoDeclaracionIdActual || ESTADO_DDJJ_DEFAULT_PERSONALES || "—")})
        </p>
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
      <p className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        Realizá tu DDJJ de familiares completando todos los datos requeridos del grupo familiar.
      </p>

      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Familiares declarados</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setFamiliares((prev) => [...prev, emptyFamiliar()])}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
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
                    disabled={disabled}
                    onClick={() =>
                      setFamiliares((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-xs font-semibold text-rose-600 disabled:opacity-50"
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
                    onChange={(e) => updateFam(idx, "parentesco_id", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Seleccionar...</option>
                    {optsParentesco.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {String(f.parentesco_id || "").toUpperCase() === PARENTESCO_OTROS_ID ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">parentesco_otro_detalle</label>
                    <input
                      value={f.parentesco_otro_detalle || ""}
                      onChange={(e) => updateFam(idx, "parentesco_otro_detalle", e.target.value)}
                      disabled={disabled}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="Detalle del parentesco (Otros)"
                    />
                      <p className="mt-1 text-[11px] text-slate-500">Obligatorio cuando seleccionás “Otros”.</p>
                  </div>
                ) : null}
                <div>
                  <label className="block text-sm font-medium text-slate-700">dni</label>
                  <input
                    value={f.dni}
                    onChange={(e) => updateFam(idx, "dni", e.target.value.replace(/\D/g, ""))}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">nombre</label>
                  <input
                    value={f.nombre}
                    onChange={(e) =>
                      updateFam(idx, "nombre", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">apellido</label>
                  <input
                    value={f.apellido}
                    onChange={(e) =>
                      updateFam(idx, "apellido", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">fecha_nacimiento</label>
                  <input
                    type="date"
                    value={f.fecha_nacimiento}
                    onChange={(e) => updateFam(idx, "fecha_nacimiento", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">notas_titular</label>
                  <input
                    value={f.notas_titular}
                    onChange={(e) => updateFam(idx, "notas_titular", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="md:col-span-2 space-y-3 pt-1 text-xs text-slate-700">
                  <div className="space-y-1">
                    <p className="font-medium">Conviven en el mismo domicilio</p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`convive-${idx}`}
                          checked={f.convive === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "convive", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`convive-${idx}`}
                          checked={f.convive === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "convive", false)}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  {f.convive === false ? (
                    <div>
                      <label className="block text-xs">Domicilio del familiar</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={f.domicilio_familiar || ""}
                        onChange={(e) => updateFam(idx, "domicilio_familiar", e.target.value)}
                        disabled={disabled}
                        placeholder="Calle, número, localidad"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Obligatorio cuando no conviven en el mismo domicilio.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-medium">Dependiente</p>
                    <p className="text-[11px] text-slate-500">
                      Indica si el familiar depende económicamente del titular.
                    </p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependiente-${idx}`}
                          checked={f.dependiente === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "dependiente", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependiente-${idx}`}
                          checked={f.dependiente === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "dependiente", false)}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  {f.dependiente === true ? (
                    <div>
                      <label className="block text-xs">Detalle de dependencia</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={f.detalle_dependencia || ""}
                        onChange={(e) => updateFam(idx, "detalle_dependencia", e.target.value)}
                        disabled={disabled}
                        placeholder="Ej: sin ingresos propios"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Obligatorio cuando indicás dependencia.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-medium">Discapacidad declarada</p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`discapacidad-${idx}`}
                          checked={f.discapacidad_declarada === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "discapacidad_declarada", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`discapacidad-${idx}`}
                          checked={f.discapacidad_declarada === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "discapacidad_declarada", false)}
                        />
                        No
                      </label>
                    </div>
                    {f.discapacidad_declarada === true ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Para validación final debés presentar CUD en la oficina correspondiente.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
