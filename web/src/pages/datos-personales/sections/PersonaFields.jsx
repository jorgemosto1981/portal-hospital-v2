export default function PersonaFields({
  form,
  setField,
  HELP,
  optsLoc,
  optsMotivoBaja,
  optsSexo,
  optsCivil,
  optsNac,
  optsProv,
  optsPais,
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">dni *</label>
        <input value={form.dni} onChange={(e) => setField("dni", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.dni}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">nombre *</label>
        <input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.nombre}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">apellido *</label>
        <input value={form.apellido} onChange={(e) => setField("apellido", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.apellido}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">nombre_completo_legal</label>
        <input value={form.nombre_completo_legal} disabled className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
        <p className="mt-1 text-xs text-slate-500">{HELP.nombre_completo_legal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">cuil</label>
        <input value={form.cuil} onChange={(e) => setField("cuil", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.cuil}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">fecha_nacimiento</label>
        <input type="date" value={form.fecha_nacimiento} onChange={(e) => setField("fecha_nacimiento", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.fecha_nacimiento}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">lugar_nacimiento_id</label>
        <select value={form.lugar_nacimiento_id} onChange={(e) => setField("lugar_nacimiento_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsLoc.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.lugar_nacimiento_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">lugar_nacimiento_texto</label>
        <input value={form.lugar_nacimiento_texto} onChange={(e) => setField("lugar_nacimiento_texto", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.lugar_nacimiento_texto}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">activo</label>
        <select value={form.activo ? "true" : "false"} onChange={(e) => setField("activo", e.target.value === "true")} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.activo}</p>
      </div>
      {!form.activo && (
        <div>
          <label className="block text-sm font-medium text-slate-700">motivo_baja_id *</label>
          <select value={form.motivo_baja_id} onChange={(e) => setField("motivo_baja_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
            <option value="">Seleccionar...</option>
            {optsMotivoBaja.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{HELP.motivo_baja_id}</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">sexo_genero_id</label>
        <select value={form.sexo_genero_id} onChange={(e) => setField("sexo_genero_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsSexo.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.sexo_genero_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">estado_civil_id</label>
        <select value={form.estado_civil_id} onChange={(e) => setField("estado_civil_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsCivil.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.estado_civil_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">nacionalidad_id</label>
        <select value={form.nacionalidad_id} onChange={(e) => setField("nacionalidad_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsNac.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.nacionalidad_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">telefono_celular</label>
        <input value={form.telefono_celular} onChange={(e) => setField("telefono_celular", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.telefono_celular}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">telefono_fijo</label>
        <input value={form.telefono_fijo} onChange={(e) => setField("telefono_fijo", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.telefono_fijo}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.recibe_notificaciones_sms}
          onChange={(e) => setField("recibe_notificaciones_sms", e.target.checked)}
        />
        Recibe notificaciones por WhatsApp
      </label>
      <div>
        <label className="block text-sm font-medium text-slate-700">email_personal</label>
        <input value={form.email_personal} onChange={(e) => setField("email_personal", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.email_personal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">calle</label>
        <input value={form.calle} onChange={(e) => setField("calle", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.calle}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">numero</label>
        <input value={form.numero} onChange={(e) => setField("numero", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.numero}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">piso</label>
        <input value={form.piso} onChange={(e) => setField("piso", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.piso}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">departamento</label>
        <input value={form.departamento} onChange={(e) => setField("departamento", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.departamento}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">provincia_id</label>
        <select value={form.provincia_id} onChange={(e) => setField("provincia_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsProv.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.provincia_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">pais_id</label>
        <select value={form.pais_id} onChange={(e) => setField("pais_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsPais.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.pais_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">localidad_id</label>
        <select value={form.localidad_id} onChange={(e) => setField("localidad_id", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2">
          <option value="">Seleccionar...</option>
          {optsLoc.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.localidad_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">codigo_postal</label>
        <input value={form.codigo_postal} onChange={(e) => setField("codigo_postal", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.codigo_postal}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">referencia</label>
        <input value={form.referencia} onChange={(e) => setField("referencia", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2" />
        <p className="mt-1 text-xs text-slate-500">{HELP.referencia}</p>
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-slate-700">foto_rostro</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
            setField("foto_file", file);
            setField("foto_file_name", file ? file.name : "");
          }}
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold"
        />
        <p className="mt-1 text-xs text-slate-500">{HELP.foto_archivo}</p>
        {form.foto_file_name ? (
          <p className="mt-1 text-xs text-slate-600">Archivo seleccionado: {form.foto_file_name}</p>
        ) : null}
      </div>
    </>
  );
}
