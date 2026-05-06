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
  onAddCargaRow,
  onChangeCargaRow,
  onRemoveCargaRow,
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
      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">
            Carga por día de semana
            {modoAvanzado ? (
              <span className="block text-xs font-normal text-slate-500">Campo técnico: carga_por_dia_semana</span>
            ) : null}
          </label>
          <button
            type="button"
            onClick={onAddCargaRow}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 active:bg-slate-50"
          >
            Agregar día
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">{ayudaCampos.carga_por_dia_semana}</p>
        <div className="space-y-2">
          {cargaPorDiaRows.map((row, idx) => (
            <div key={`carga-dia-${idx}`} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
              <LabeledSelect
                bare
                value={row.dia_semana_id}
                onValueChange={(v) => onChangeCargaRow(idx, "dia_semana_id", v)}
                options={opcionesDiaSemana}
                placeholder="Seleccionar día..."
              />
              <LabeledTextField
                bare
                value={row.horas}
                onValueChange={(v) => onChangeCargaRow(idx, "horas", v)}
                placeholder="Horas (0..24)"
                inputMode="decimal"
              />
              <button
                type="button"
                onClick={() => onRemoveCargaRow(idx)}
                className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 touch-manipulation active:bg-rose-100"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
