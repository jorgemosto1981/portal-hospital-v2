const SELECT_CLASS =
  "mt-1 h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2";

/** Sin margen superior; para filas compactas (p. ej. carga por día). */
const SELECT_CLASS_BARE =
  "h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2";

/**
 * Select de catálogo con etiqueta y ayuda (formulario laboral).
 * Con `bare`, solo el select (mismas opciones), sin label ni ayuda.
 */
export default function LabeledSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  helpText,
  optionLabel,
  technicalName,
  showTechnicalName = false,
  bare = false,
}) {
  const formatLabel =
    optionLabel ||
    ((row) => {
      if (row && typeof row.label === "string" && row.label.trim()) return row.label;
      const n = row?.nombre;
      const id = row?.id;
      return n ? String(n) : String(id ?? "");
    });

  const selectEl = (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={bare ? SELECT_CLASS_BARE : SELECT_CLASS}
    >
      <option value="">{placeholder}</option>
      {(options || []).map((x) => (
        <option key={x.id} value={x.id}>
          {formatLabel(x)}
        </option>
      ))}
    </select>
  );

  if (bare) return selectEl;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {showTechnicalName && technicalName ? (
        <p className="mt-0.5 text-xs text-slate-500">Campo técnico: {technicalName}</p>
      ) : null}
      {selectEl}
      {helpText ? <p className="mt-1 text-xs text-slate-500">{helpText}</p> : null}
    </div>
  );
}
