import { useEffect, useMemo, useRef, useState } from "react";

export default function PersonaSearchSelect({
  personaId,
  setPersonaId,
  personaOptions,
  modoAvanzado = false,
}) {
  const [personaQuery, setPersonaQuery] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const wrapRef = useRef(null);
  const personaOptionsFiltradas = useMemo(() => {
    const q = String(personaQuery || "").trim().toLowerCase();
    if (!q) return personaOptions || [];
    return (personaOptions || []).filter((o) =>
      [o.label, o.secondary, o.selectedLabel].some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [personaOptions, personaQuery]);
  const personaSeleccionadaLabel = useMemo(() => {
    const o = (personaOptions || []).find((x) => String(x.value) === String(personaId || ""));
    return o ? (o.selectedLabel || o.label) : "";
  }, [personaOptions, personaId]);

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen]);

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-semibold tracking-wide text-slate-600">
        <span className="uppercase">PERSONA</span>
        {modoAvanzado ? <span className="ml-1 text-[11px] text-slate-500">(persona_id)</span> : null}
      </label>
      <input
        value={personaOpen ? personaQuery : personaSeleccionadaLabel}
        onFocus={() => {
          setPersonaOpen(true);
          setPersonaQuery("");
        }}
        onChange={(e) => {
          setPersonaOpen(true);
          setPersonaQuery(e.target.value);
        }}
        placeholder="Buscar por nombre, apellido, DNI o ID..."
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2 focus-visible:ring-2"
      />
      <p className="mt-1 text-xs text-slate-500">
        Persona activa:{" "}
        <span className="font-semibold text-slate-700">
          {personaSeleccionadaLabel || "sin seleccionar"}
        </span>
      </p>
      {personaOpen && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              setPersonaId("");
              setPersonaQuery("");
              setPersonaOpen(false);
            }}
            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
          >
            Seleccionar persona...
          </button>
          {personaOptionsFiltradas.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Sin resultados.</p>
          ) : (
            personaOptionsFiltradas.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  setPersonaId(o.value);
                  setPersonaQuery("");
                  setPersonaOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50"
              >
                <span className="block">{o.label}</span>
                {o.secondary ? <span className="block text-xs italic text-slate-500">({o.secondary})</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
