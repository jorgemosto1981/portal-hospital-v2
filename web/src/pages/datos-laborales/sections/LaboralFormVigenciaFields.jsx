import LabeledSelect from "../components/LabeledSelect.jsx";
import LabeledTextField from "../components/LabeledTextField.jsx";

export default function LaboralFormVigenciaFields({
  tipoAlta,
  modoAvanzado,
  formData,
  onChangeField,
  opcionesCausalFinAsignacion,
  ayudaCampos,
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <LabeledTextField
        label={
          tipoAlta === "historial_laboral_cargos"
            ? "Fecha inicio (cargo)"
            : "Fecha inicio (asignación en grupo)"
        }
        type="date"
        value={formData.fecha_desde}
        onValueChange={(v) => onChangeField("fecha_desde", v)}
        helpText={ayudaCampos.fecha_desde}
        technicalName="fecha_desde"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label={
          tipoAlta === "historial_laboral_cargos"
            ? "Fecha fin (cargo)"
            : "Fecha fin (asignación en grupo)"
        }
        type="date"
        value={formData.fecha_hasta}
        onValueChange={(v) => onChangeField("fecha_hasta", v)}
        min={formData.fecha_desde || undefined}
        helpText={ayudaCampos.fecha_hasta}
        technicalName="fecha_hasta"
        showTechnicalName={modoAvanzado}
      />
      {tipoAlta === "historial_laboral_cargos" && (
        <LabeledSelect
          label="Causal de finalización"
          value={formData.causal_fin_asignacion_id}
          onValueChange={(v) => onChangeField("causal_fin_asignacion_id", v)}
          options={opcionesCausalFinAsignacion}
          placeholder="Seleccionar causal..."
          helpText={ayudaCampos.causal_fin_asignacion_id}
          technicalName="causal_fin_asignacion_id"
          showTechnicalName={modoAvanzado}
        />
      )}
    </div>
  );
}
