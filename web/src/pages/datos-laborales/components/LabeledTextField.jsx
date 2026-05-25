const INPUT_CLASS =
  "mt-1 h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2";

const INPUT_CLASS_BARE =
  "h-11 w-full touch-manipulation rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2";

/**
 * Con `bare`, solo el input, sin label ni ayuda.
 */
export default function LabeledTextField({
  label,
  value,
  onValueChange,
  helpText,
  technicalName,
  showTechnicalName = false,
  type = "text",
  placeholder,
  inputMode,
  min,
  bare = false,
}) {
  const inputEl = (
    <input
      type={type}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      min={min}
      className={bare ? INPUT_CLASS_BARE : INPUT_CLASS}
    />
  );

  if (bare) return inputEl;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {showTechnicalName && technicalName ? (
        <p className="mt-0.5 text-xs text-slate-500">Campo técnico: {technicalName}</p>
      ) : null}
      {inputEl}
      {helpText ? <p className="mt-1 text-xs text-slate-500">{helpText}</p> : null}
    </div>
  );
}
