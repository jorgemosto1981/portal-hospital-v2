export default function ConsentimientosFields({
  form,
  setField,
  HELP,
  optsTipoConsent,
  optsTextosLegales,
  optsIdioma,
}) {
  return (
    <>
      <p className="md:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Esta etapa registra consentimiento aceptado. El backend fija `aceptado=true`, completa
        `aceptado_en` automáticamente, calcula `texto_hash` desde `cfg_textos_legales` y bloquea
        cambios de campos legales en consentimientos ya aceptados.
      </p>
      <div>
        <label className="block text-sm font-medium text-slate-700">tipo_consentimiento_id *</label>
        <select
          value={form.tipo_consentimiento_id}
          onChange={(e) => setField("tipo_consentimiento_id", e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
        >
          <option value="">Seleccionar...</option>
          {optsTipoConsent.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.tipo_consentimiento_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">version_id *</label>
        <select
          value={form.version_id}
          onChange={(e) => setField("version_id", e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
        >
          <option value="">Seleccionar...</option>
          {optsTextosLegales.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.version_id}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">idioma_id</label>
        <select
          value={form.idioma_id}
          onChange={(e) => setField("idioma_id", e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
        >
          <option value="">Seleccionar...</option>
          {optsIdioma.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP.idioma_id}</p>
      </div>
    </>
  );
}
