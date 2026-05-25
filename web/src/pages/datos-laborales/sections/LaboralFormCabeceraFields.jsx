import LabeledSelect from "../components/LabeledSelect.jsx";

export default function LaboralFormCabeceraFields({
  tipoAlta,
  setTipoAlta,
  opcionesTipoAlta,
  showNivelRegistro = true,
  modoAvanzado,
  onChangeField,
  opcionesGrupos,
  ayudaCampos,
  formData,
}) {
  return (
    <>
      {showNivelRegistro ? (
        <LabeledSelect
          label={
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nivel de registro
            </span>
          }
          value={tipoAlta}
          onValueChange={(v) => setTipoAlta(v)}
          options={opcionesTipoAlta}
          placeholder="Elegir nivel..."
          technicalName="tipoAlta"
          showTechnicalName={modoAvanzado}
        />
      ) : null}

      {tipoAlta === "historial_laboral_grupos" ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
          <LabeledSelect
            label="Grupo de trabajo *"
            value={formData.grupo_de_trabajo_id}
            onValueChange={(v) => onChangeField("grupo_de_trabajo_id", v)}
            options={opcionesGrupos}
            placeholder="Seleccionar grupo..."
            helpText={ayudaCampos.grupo_de_trabajo_id}
            technicalName="grupo_de_trabajo_id"
            showTechnicalName={modoAvanzado}
          />
        </div>
      ) : null}
    </>
  );
}
