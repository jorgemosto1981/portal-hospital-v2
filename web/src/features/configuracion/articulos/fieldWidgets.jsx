import { useMemo, useRef, useState } from "react";
import { PALETA_COLORES } from "./articuloLabels.js";

function RequiredBadge({ required }) {
  if (required === true) return <span className="ml-0.5 text-red-500">*</span>;
  if (required === false) return <span className="ml-1 text-[10px] font-normal text-slate-400">(Opcional)</span>;
  return null;
}

export function FieldText({ label, value, onChange, placeholder, inputMode, helpText, className = "", required }) {
  return (
    <label className={`block space-y-1 ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
      />
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

export function FieldNumber({ label, value, onChange, min = 0, helpText, required }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <input
        type="number"
        min={min}
        value={value === "" ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
      />
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

export function FieldCheck({ label, checked, onChange, helpText, className = "", required }) {
  return (
    <label className={`block cursor-pointer rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 ${className}`.trim()}>
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        <span className="text-sm text-slate-800">
          {label}
          <RequiredBadge required={required} />
        </span>
      </span>
      {helpText ? <span className="mt-1 block text-[11px] text-slate-500">{helpText}</span> : null}
    </label>
  );
}

/**
 * Select con helpText dinámico: si `explicaciones[value]` existe, lo muestra con estilo
 * destacado; sino usa `option.descripcion` de la BD como fallback.
 */
export function FieldSelect({
  label, value, onChange, options, disabled,
  placeholder = "Elegí una opción…", helpText, className = "",
  omitLabel = false, required, explicaciones,
}) {
  const textoExplicacion = useMemo(() => {
    if (!value) return null;
    if (explicaciones && explicaciones[value]) return explicaciones[value];
    const opt = options.find((o) => o.value === value);
    return opt?.descripcion || null;
  }, [value, explicaciones, options]);

  return (
    <label className={`block space-y-1 ${className}`.trim()}>
      {!omitLabel ? (
        <span className="text-xs font-medium text-slate-600">
          {label}
          <RequiredBadge required={required} />
        </span>
      ) : null}
      <select
        aria-label={omitLabel ? label : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} title={o.descripcion || undefined}>
            {o.label}
          </option>
        ))}
      </select>
      {textoExplicacion ? (
        <span className="mt-1 block rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] leading-relaxed text-blue-800">
          {textoExplicacion}
        </span>
      ) : helpText ? (
        <span className="block text-[11px] text-slate-500">{helpText}</span>
      ) : null}
    </label>
  );
}

/**
 * Selector visual de color: grilla de colores predefinidos + picker personalizado.
 * Persiste el valor como HEX (#RRGGBB).
 */
export function FieldColor({ label, value, onChange, required }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  const selectedPreset = PALETA_COLORES.find((c) => c.hex.toUpperCase() === (value || "").toUpperCase());
  const isCustom = value && !selectedPreset;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {PALETA_COLORES.map((c) => {
          const activo = c.hex.toUpperCase() === (value || "").toUpperCase();
          return (
            <button
              key={c.hex}
              type="button"
              title={c.nombre}
              onClick={() => onChange(c.hex)}
              className={[
                "h-8 w-8 rounded-full border-2 transition-transform active:scale-90",
                activo ? "border-slate-900 ring-2 ring-blue-300 ring-offset-1" : "border-slate-200",
              ].join(" ")}
              style={{ backgroundColor: c.hex }}
            >
              <span className="sr-only">{c.nombre}</span>
            </button>
          );
        })}
        <button
          type="button"
          title="Color personalizado"
          onClick={() => {
            setShowPicker(true);
            requestAnimationFrame(() => pickerRef.current?.click());
          }}
          className={[
            "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform active:scale-90",
            isCustom ? "border-slate-900 ring-2 ring-blue-300 ring-offset-1" : "border-slate-200 bg-white text-slate-500",
          ].join(" ")}
          style={isCustom ? { backgroundColor: value } : undefined}
        >
          {isCustom ? "" : "…"}
        </button>
        <input
          ref={pickerRef}
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={showPicker ? "h-0 w-0 overflow-hidden opacity-0" : "hidden"}
          tabIndex={-1}
        />
      </div>
      {(selectedPreset || isCustom) && (
        <p className="text-[11px] text-slate-500">
          {selectedPreset ? selectedPreset.nombre : `Personalizado: ${value}`}
          {value ? (
            <span className="ml-1 font-mono text-slate-400">{value}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}
