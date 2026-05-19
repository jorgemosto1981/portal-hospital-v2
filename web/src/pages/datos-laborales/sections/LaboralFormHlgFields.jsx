import LabeledSelect from "../components/LabeledSelect.jsx";
import LabeledTextField from "../components/LabeledTextField.jsx";

export default function LaboralFormHlgFields({
  modoAvanzado,
  formData,
  onChangeField,
  opcionesRegimenHorario,
  opcionesCentroCosto,
  opcionesFuncion,
  cargaPorDiaRows,
  onChangeCargaRow,
  opcionesDiaSemana,
  ayudaCampos,
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
      <LabeledSelect
        label="Régimen horario"
        value={formData.regimen_horario_id}
        onValueChange={(v) => onChangeField("regimen_horario_id", v)}
        options={opcionesRegimenHorario}
        placeholder="Seleccionar régimen..."
        helpText={ayudaCampos.regimen_horario_id}
        technicalName="regimen_horario_id"
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
      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Carga por día de semana (7 días)
          {modoAvanzado ? (
            <span className="block text-xs font-normal text-slate-500">Campo técnico: carga_por_dia_semana</span>
          ) : null}
        </label>
        <p className="mb-2 text-xs text-slate-500">{ayudaCampos.carga_por_dia_semana}</p>
        <div className="space-y-2">
          {cargaPorDiaRows.map((row, idx) => {
            const diaOpt = (opcionesDiaSemana || []).find((o) => String(o.id) === String(row.dia_semana_id));
            const diaLabel = diaOpt && diaOpt.nombre ? String(diaOpt.nombre) : row.dia_semana_id || `Día ${idx + 1}`;
            return (
              <div key={`carga-dia-${row.dia_semana_id || idx}`} className="grid gap-2 md:grid-cols-[1fr_140px]">
                <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
                  {diaLabel}
                </p>
                <LabeledTextField
                  bare
                  value={row.horas}
                  onValueChange={(v) => onChangeCargaRow(idx, "horas", v)}
                  placeholder="0..24"
                  inputMode="decimal"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
