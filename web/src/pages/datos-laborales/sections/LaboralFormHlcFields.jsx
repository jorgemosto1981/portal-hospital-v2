import LabeledSelect from "../components/LabeledSelect.jsx";
import LabeledTextField from "../components/LabeledTextField.jsx";

export default function LaboralFormHlcFields({
  modoAvanzado,
  formData,
  onChangeField,
  opcionesEfectores,
  opcionesRol,
  opcionesEstadoAsignacion,
  opcionesEscalafon,
  opcionesAgrupamiento,
  opcionesTipoVinculo,
  opcionesCategorias,
  opcionesFuncion,
  opcionesModalidadJornada,
  opcionesTipoActo,
  ayudaCampos,
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
      <LabeledSelect
        label="Efector de designación *"
        value={formData.efector_designacion_id}
        onValueChange={(v) => onChangeField("efector_designacion_id", v)}
        options={opcionesEfectores}
        placeholder="Seleccionar efector..."
        helpText={ayudaCampos.efector_designacion_id}
        technicalName="efector_designacion_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Efector de cumplimiento *"
        value={formData.efector_cumplimiento_id}
        onValueChange={(v) => onChangeField("efector_cumplimiento_id", v)}
        options={opcionesEfectores}
        placeholder="Seleccionar efector..."
        helpText={ayudaCampos.efector_cumplimiento_id}
        technicalName="efector_cumplimiento_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Rol"
        value={formData.rol_id}
        onValueChange={(v) => onChangeField("rol_id", v)}
        options={opcionesRol}
        placeholder="Seleccionar rol..."
        helpText={ayudaCampos.rol_id}
        technicalName="rol_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Estado de asignación"
        value={formData.estado_asignacion_id}
        onValueChange={(v) => onChangeField("estado_asignacion_id", v)}
        options={opcionesEstadoAsignacion}
        placeholder="Seleccionar estado..."
        helpText={ayudaCampos.estado_asignacion_id}
        technicalName="estado_asignacion_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Escalafón"
        value={formData.escalafon_id}
        onValueChange={(v) => onChangeField("escalafon_id", v)}
        options={opcionesEscalafon}
        placeholder="Seleccionar escalafón..."
        helpText={ayudaCampos.escalafon_id}
        technicalName="escalafon_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Agrupamiento"
        value={formData.agrupamiento_id}
        onValueChange={(v) => onChangeField("agrupamiento_id", v)}
        options={opcionesAgrupamiento}
        placeholder="Seleccionar agrupamiento..."
        helpText={ayudaCampos.agrupamiento_id}
        technicalName="agrupamiento_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Tipo de vínculo"
        value={formData.tipo_vinculo_id}
        onValueChange={(v) => onChangeField("tipo_vinculo_id", v)}
        options={opcionesTipoVinculo}
        placeholder="Seleccionar tipo de vínculo..."
        helpText={ayudaCampos.tipo_vinculo_id}
        technicalName="tipo_vinculo_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Categoría"
        value={formData.categoria_id}
        onValueChange={(v) => onChangeField("categoria_id", v)}
        options={opcionesCategorias}
        placeholder="Seleccionar categoría..."
        helpText={ayudaCampos.categoria_id}
        technicalName="categoria_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Cargo funcional"
        value={formData.cargo_funcional_id}
        onValueChange={(v) => onChangeField("cargo_funcional_id", v)}
        options={opcionesFuncion}
        placeholder="Seleccionar cargo funcional..."
        helpText={ayudaCampos.cargo_funcional_id}
        technicalName="cargo_funcional_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Modalidad de jornada"
        value={formData.modalidad_jornada_id}
        onValueChange={(v) => onChangeField("modalidad_jornada_id", v)}
        options={opcionesModalidadJornada}
        placeholder="Seleccionar modalidad..."
        helpText={ayudaCampos.modalidad_jornada_id}
        technicalName="modalidad_jornada_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledSelect
        label="Respaldo normativo · tipo de acto *"
        value={formData.referencia_tipo_acto_id}
        onValueChange={(v) => onChangeField("referencia_tipo_acto_id", v)}
        options={opcionesTipoActo}
        placeholder="Seleccionar tipo de acto..."
        helpText={ayudaCampos.referencias_normativa_designacion}
        technicalName="referencia_tipo_acto_id"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label="Respaldo normativo · número *"
        value={formData.referencia_numero}
        onValueChange={(v) => onChangeField("referencia_numero", v)}
        technicalName="referencia_numero"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label="Respaldo normativo · fecha *"
        type="date"
        value={formData.referencia_fecha}
        onValueChange={(v) => onChangeField("referencia_fecha", v)}
        technicalName="referencia_fecha"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label="Respaldo normativo · detalle"
        value={formData.referencia_detalle}
        onValueChange={(v) => onChangeField("referencia_detalle", v)}
        technicalName="referencia_detalle"
        showTechnicalName={modoAvanzado}
      />
      <LabeledTextField
        label="Carga horaria total"
        value={formData.carga_horaria_total}
        onValueChange={(v) => onChangeField("carga_horaria_total", v)}
        placeholder="36"
        inputMode="decimal"
        helpText={ayudaCampos.carga_horaria_total}
        technicalName="carga_horaria_total"
        showTechnicalName={modoAvanzado}
      />
    </div>
  );
}
