import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PALETA_COLORES } from "./articuloLabels.js";
import { listarColeccion } from "../../../services/configuracionCatalogosService.js";

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

export function FieldNumber({
  label, value, onChange, min = 0, max, step, helpText, required,
}) {
  const useDecimals = step != null && Number(step) > 0 && Number(step) < 1;

  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value === "" ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange("");
            return;
          }
          const n = useDecimals ? parseFloat(raw) : Number(raw);
          onChange(Number.isFinite(n) ? n : "");
        }}
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

/**
 * Dropdown de seleccion multiple con chips.
 * `onChange` siempre devuelve un array (nunca null/undefined).
 */
export function FieldMultiSelect({
  label, value = [], options, onChange, disabled,
  placeholder = "Todos (sin restricción)", helpText, className = "", required,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = useMemo(() => new Set(Array.isArray(value) ? value : []), [value]);
  const available = useMemo(() => options.filter((o) => !selected.has(o.value)), [options, selected]);

  useEffect(() => {
    if (!open) return undefined;
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const addItem = useCallback(
    (val) => {
      if (!val) return;
      const next = [...(Array.isArray(value) ? value : []), val];
      onChange(next);
      setOpen(false);
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (val) => {
      const next = (Array.isArray(value) ? value : []).filter((v) => v !== val);
      onChange(next);
    },
    [value, onChange],
  );

  const labelMap = useMemo(() => {
    const m = new Map();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  return (
    <div ref={containerRef} className={`relative block space-y-1 ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <div
        className={[
          "flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5",
          disabled ? "cursor-not-allowed border-slate-100 bg-slate-50" : "cursor-pointer border-slate-200",
        ].join(" ")}
        onClick={() => { if (!disabled) setOpen((p) => !p); }}
      >
        {selected.size === 0 ? (
          <span className="text-sm text-slate-400">{placeholder}</span>
        ) : (
          Array.from(selected).map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
            >
              {labelMap.get(id) || id}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeItem(id); }}
                  className="ml-0.5 text-blue-400 hover:text-blue-700"
                  aria-label={`Quitar ${labelMap.get(id) || id}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {open && available.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {available.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-blue-50"
                onClick={() => addItem(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && available.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          Sin opciones disponibles
        </div>
      )}
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </div>
  );
}

/**
 * Buscador con autocompletado para la coleccion `personas`.
 * Carga personas via listarColeccion y permite filtrar por nombre, apellido o DNI.
 * `onChange` siempre devuelve un array (nunca null/undefined).
 */
export function FieldPersonaSearch({
  label, value = [], onChange, helpText, disabled, className = "", required,
}) {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = useMemo(() => new Set(Array.isArray(value) ? value : []), [value]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const items = await listarColeccion("personas");
        if (!cancelled) setPersonas(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setPersonas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const personaLabel = useCallback((p) => {
    const parts = [p.apellido, p.nombre].filter(Boolean);
    const name = parts.length > 0 ? parts.join(", ") : null;
    const dni = p.dni || p.documento_numero;
    if (name && dni) return `${name} (${dni})`;
    if (name) return name;
    if (dni) return `DNI ${dni}`;
    return p.id;
  }, []);

  const labelMap = useMemo(() => {
    const m = new Map();
    for (const p of personas) m.set(p.id, personaLabel(p));
    return m;
  }, [personas, personaLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personas.filter((p) => !selected.has(p.id)).slice(0, 20);
    return personas
      .filter((p) => {
        if (selected.has(p.id)) return false;
        const text = personaLabel(p).toLowerCase();
        return text.includes(q) || (p.id && p.id.toLowerCase().includes(q));
      })
      .slice(0, 20);
  }, [personas, query, selected, personaLabel]);

  useEffect(() => {
    if (!open) return undefined;
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const addItem = useCallback(
    (id) => {
      const next = [...(Array.isArray(value) ? value : []), id];
      onChange(next);
      setQuery("");
      setOpen(false);
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (id) => {
      const next = (Array.isArray(value) ? value : []).filter((v) => v !== id);
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <div ref={containerRef} className={`relative block space-y-1 ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">
        {label}
        <RequiredBadge required={required} />
      </span>
      <div className="space-y-1.5">
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selected).map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800"
              >
                {labelMap.get(id) || id}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeItem(id)}
                    className="ml-0.5 text-blue-400 hover:text-blue-700"
                    aria-label={`Quitar ${labelMap.get(id) || id}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled || loading}
          placeholder={loading ? "Cargando personas…" : "Buscar por nombre, apellido o DNI…"}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
      {open && !loading && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-blue-50"
                onClick={() => addItem(p.id)}
              >
                {personaLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && filtered.length === 0 && query.trim() && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          Sin resultados
        </div>
      )}
      {helpText ? <span className="block text-[11px] text-slate-500">{helpText}</span> : null}
    </div>
  );
}
