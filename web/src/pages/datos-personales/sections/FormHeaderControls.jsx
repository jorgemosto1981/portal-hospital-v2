import { useEffect, useMemo, useRef, useState } from "react";

const COLECCIONES_OPTIONS = [
  { value: "personas", label: "DATOS PERSONALES", id: "personas" },
  { value: "formacion_agente", label: "FORMACION DEL AGENTE", id: "formacion_agente" },
  {
    value: "declaraciones_grupo_familiar",
    label: "DECLARACION DE GRUPO FAMILIAR",
    id: "declaraciones_grupo_familiar",
  },
  { value: "consentimientos", label: "CONSENTIMIENTOS", id: "consentimientos" },
];

export default function FormHeaderControls({
  tipo,
  setTipo,
  personaId,
  setPersonaId,
  personaOptions,
  showPersonaSelector = true,
  modoEdicion,
  setModoEdicion,
  setEditId,
  registros,
  hydrateFrom,
  showUpdateButton = true,
  canUpdate = true,
  updateDisabledReason = "",
}) {
  const [personaQuery, setPersonaQuery] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const personaWrapRef = useRef(null);
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
  const isPersonasSection = String(tipo || "").trim() === "personas";

  function onClickActualizarInformacion() {
    if (!canUpdate) return;
    const next = !modoEdicion;
    setModoEdicion(next);
    setEditId("");
    if (!next) return;
    const first = (registros || [])[0];
    if (first && first.id) {
      setEditId(String(first.id));
      hydrateFrom(first);
    }
  }

  useEffect(() => {
    if (!personaOpen) return;
    function onDocClick(ev) {
      if (!personaWrapRef.current) return;
      if (!personaWrapRef.current.contains(ev.target)) setPersonaOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [personaOpen]);

  return (
    <>
      {isPersonasSection ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold text-slate-900">Datos Personales</p>
              <p className="mt-1 text-sm text-slate-600">Se visualizan tus datos personales actuales.</p>
            </div>
            {showUpdateButton ? (
              <button
                type="button"
                disabled={!canUpdate}
                onClick={onClickActualizarInformacion}
                className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                  modoEdicion
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                }`}
              >
                Actualizar información
              </button>
            ) : null}
          </div>
          {!canUpdate && showUpdateButton && updateDisabledReason ? (
            <p className="mt-2 text-xs text-slate-500">{updateDisabledReason}</p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {showPersonaSelector ? (
          <div ref={personaWrapRef} className="relative">
            <label className="block text-xs font-semibold tracking-wide text-slate-600">
              <span className="uppercase">PERSONA</span>
              <span className="field-id ml-1 text-[11px] text-slate-500">(persona_id)</span>
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
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
            />
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
                      {o.secondary ? (
                        <span className="block text-xs italic text-slate-500">({o.secondary})</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-slate-600">
              <span className="uppercase">PERSONA</span>
              <span className="field-id ml-1 text-slate-500">(persona_id)</span>
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{personaId || "sin persona vinculada"}</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold tracking-wide text-slate-600">
            <span className="uppercase">COLECCION</span>
            <span className="field-id ml-1 text-[11px] text-slate-500">(tipo)</span>
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            {COLECCIONES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.id})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Seleccionar colección de datos a editar.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-end">
          <div>
            {showUpdateButton && !isPersonasSection ? (
            <button
              type="button"
              disabled={!canUpdate}
              onClick={onClickActualizarInformacion}
              className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                modoEdicion
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              }`}
            >
              Actualizar información
            </button>
            ) : null}
            {modoEdicion && tipo !== "personas" && personaId ? (
              <p className="mt-1 text-xs text-slate-500">Se editará automáticamente el registro vigente (última carga).</p>
            ) : null}
            {!canUpdate && showUpdateButton && updateDisabledReason ? (
              <p className="mt-1 text-xs text-slate-500">{updateDisabledReason}</p>
            ) : null}
          </div>
        </div>
        {modoEdicion && !personaId ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Seleccioná primero un <span className="font-semibold">persona_id</span> para listar registros a editar.
          </p>
        ) : null}
      </div>

    </>
  );
}
