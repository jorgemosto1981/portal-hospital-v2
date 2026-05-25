import LabeledSelect from "../components/LabeledSelect.jsx";

export default function LaboralFormModoEdicionFields({
  modoEdicion,
  modoAvanzado,
  formData,
  registroEditId,
  setModoEdicion,
  setRegistroEditId,
  registrosPorTipoFiltrados,
  registrosEdicionDetallados,
  cargarRegistroEnFormulario,
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={modoEdicion}
          onChange={(e) => {
            const checked = e.target.checked;
            setModoEdicion(checked);
            setRegistroEditId("");
            if (!checked) return;
            const first = registrosPorTipoFiltrados[0];
            if (first && first.id) {
              setRegistroEditId(String(first.id));
              cargarRegistroEnFormulario(first);
            }
          }}
        />
        Editar registro existente
      </label>
      {modoEdicion && !formData.persona_id && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Seleccioná primero una <span className="font-semibold">persona</span> para listar registros.
        </p>
      )}
      {modoEdicion && (
        <LabeledSelect
          label="Registro a editar"
          value={registroEditId}
          onValueChange={(id) => {
            setRegistroEditId(id);
            const target = registrosPorTipoFiltrados.find((x) => String(x.id) === String(id));
            if (target) cargarRegistroEnFormulario(target);
          }}
          options={registrosEdicionDetallados}
          placeholder="Seleccionar registro..."
          technicalName="registroEditId"
          showTechnicalName={modoAvanzado}
        />
      )}
    </div>
  );
}
