import LabeledSelect from "../components/LabeledSelect.jsx";
import LabeledTextField from "../components/LabeledTextField.jsx";

export default function LaboralFormHlgFields({
  modoAvanzado,
  modoEdicion,
  formData,
  onChangeField,
  opcionesRegimenHorario,
  opcionesCentroCosto,
  opcionesFuncion,
  ayudaCampos,
}) {
  const regimenBloqueadoEnEdicion = modoEdicion && !!String(formData.regimen_horario_id || "").trim();
  const ayudaRegimen = regimenBloqueadoEnEdicion
    ? `${ayudaCampos.regimen_horario_id} En edición el régimen no se modifica: cerrá el período y creá una nueva asignación desde la fecha del cambio.`
    : ayudaCampos.regimen_horario_id;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
      <LabeledSelect
        label="Régimen horario"
        value={formData.regimen_horario_id}
        onValueChange={(v) => onChangeField("regimen_horario_id", v)}
        options={opcionesRegimenHorario}
        placeholder="Seleccionar régimen..."
        helpText={ayudaRegimen}
        technicalName="regimen_horario_id"
        showTechnicalName={modoAvanzado}
        disabled={regimenBloqueadoEnEdicion}
        required
      />
      <LabeledTextField
        label="Fecha ancla (rotativos)"
        value={formData.regimen_fecha_ancla}
        onValueChange={(v) => onChangeField("regimen_fecha_ancla", v)}
        placeholder="YYYY-MM-DD"
        type="date"
        helpText={ayudaCampos.regimen_fecha_ancla}
        technicalName="regimen_fecha_ancla"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Centro de costo"
        value={formData.centro_costo_id}
        onValueChange={(v) => onChangeField("centro_costo_id", v)}
        options={opcionesCentroCosto}
        placeholder="Seleccionar centro de costo..."
        helpText={ayudaCampos.centro_costo_id}
        technicalName="centro_costo_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Función real"
        value={formData.funcion_real_id}
        onValueChange={(v) => onChangeField("funcion_real_id", v)}
        options={opcionesFuncion}
        placeholder="Seleccionar función..."
        helpText={ayudaCampos.funcion_real_id}
        technicalName="funcion_real_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label="Nivel jerárquico"
        value={formData.nivel_jerarquico}
        onValueChange={(v) => onChangeField("nivel_jerarquico", v)}
        placeholder="1..99"
        inputMode="numeric"
        helpText={ayudaCampos.nivel_jerarquico}
        technicalName="nivel_jerarquico"
        showTechnicalName={modoAvanzado}
      />
    </div>
  );
}
