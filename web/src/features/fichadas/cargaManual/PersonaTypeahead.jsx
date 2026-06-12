import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";

/**
 * @param {{
 *   opciones: Array<{ persona_id: string; label: string; dni?: string }>;
 *   value: { persona_id: string; label: string } | null;
 *   onSelect: (p: { persona_id: string; label: string; grupo_trabajo_id?: string }) => void;
 *   onClear: () => void;
 *   onEnterAdvance?: () => void;
 *   disabled?: boolean;
 * }} props
 */
const PersonaTypeahead = forwardRef(function PersonaTypeahead(
  { opciones, value, onSelect, onClear, onEnterAdvance, disabled },
  ref,
) {
  const [query, setQuery] = useState(value?.label || "");
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setQuery(value?.label || "");
  }, [value?.persona_id, value?.label]);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opciones.slice(0, 12);
    return opciones
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          String(o.dni || "").includes(q) ||
          o.persona_id.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [opciones, query]);

  const pick = useCallback(
    (o) => {
      onSelect({
        persona_id: o.persona_id,
        label: o.label,
        grupo_trabajo_id: o.grupo_trabajo_id,
      });
      setQuery(o.label);
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery("");
        onClear();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, Math.max(0, filtradas.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (value?.persona_id) {
          onEnterAdvance?.();
          return;
        }
        const o = filtradas[highlight];
        if (o) {
          pick(o);
          onEnterAdvance?.();
        }
      }
    },
    [filtradas, highlight, onClear, onEnterAdvance, pick, value?.persona_id],
  );

  return (
    <div className="relative">
      <input
        ref={ref}
        type="search"
        autoComplete="off"
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        placeholder="Agente (nombre / DNI / per_*)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (value) onClear();
        }}
        onKeyDown={onKeyDown}
      />
      {query && !value && filtradas.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg text-sm">
          {filtradas.map((o, i) => (
            <li key={o.persona_id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${
                  i === highlight ? "bg-blue-50" : ""
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  pick(o);
                }}
              >
                {o.label}
                {o.dni ? <span className="ml-2 text-slate-400">{o.dni}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

export default PersonaTypeahead;
