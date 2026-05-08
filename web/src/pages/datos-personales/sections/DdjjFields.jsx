import { useEffect, useState } from "react";

export default function DdjjFields({
  ESTADO_DDJJ_DEFAULT_PERSONALES,
  estadoDeclaracionIdActual,
  estadoDeclaracionUiLabel,
  HELP,
  modoEdicion,
  form,
  nextDeclaracionVersion,
  setFamiliares,
  emptyFamiliar,
  familiares,
  optsParentesco,
  setField,
  flowMode = "edit",
  onStartDdjj = () => {},
  onActualizarDdjj = () => {},
  onBackToEdit = () => {},
  disabled = false,
  hideTopSummary = false,
  hideOperationalNotes = false,
}) {
  function labelWithId(label, id) {
    return (
      <span>
        {label} <span className="text-xs italic text-slate-500">({id})</span>
      </span>
    );
  }

  const PARENTESCO_OTROS_ID = "CFG_PAR_OTROS";
  const [activeIndex, setActiveIndex] = useState(0);

  function updateFam(idx, key, value) {
    setFamiliares((prev) => prev.map((x, i) => (i === idx ? { ...x, [key]: value } : x)));
  }

  useEffect(() => {
    if (!Array.isArray(familiares) || familiares.length === 0) return;
    if (activeIndex < familiares.length) return;
    setActiveIndex(Math.max(0, familiares.length - 1));
  }, [familiares, activeIndex]);

  function addOtroFamiliar() {
    setFamiliares((prev) => {
      const next = [...prev, emptyFamiliar()];
      setActiveIndex(next.length - 1);
      return next;
    });
  }

  const parentescoLabelById = new Map(
    (optsParentesco || []).map((o) => [String(o.value || "").trim(), String(o.label || o.value || "").trim()]),
  );

  function familiarTieneDatos(familiar) {
    if (!familiar || typeof familiar !== "object") return false;
    return [familiar.parentesco_id, familiar.dni, familiar.nombre, familiar.apellido, familiar.fecha_nacimiento]
      .some((v) => String(v || "").trim());
  }

  function familiarCompleto(familiar) {
    if (!familiarTieneDatos(familiar)) return false;
    return [familiar.parentesco_id, familiar.dni, familiar.nombre, familiar.apellido, familiar.fecha_nacimiento]
      .every((v) => String(v || "").trim());
  }

  function formatFechaDdMmAaaa(value) {
    const raw = String(value || "").trim();
    if (!raw) return "—";
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }

  return (
    <>
      {!hideTopSummary ? (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700">Estado de declaración</label>
            <input
              value={estadoDeclaracionUiLabel || "Pendiente de presentación"}
              disabled
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none"
            />
            <p className="mt-1 text-[11px] italic text-slate-500">
              ({String(estadoDeclaracionIdActual || ESTADO_DDJJ_DEFAULT_PERSONALES || "—")})
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Versión DDJJ</label>
            <input
              value={String(form.declaracion_version || nextDeclaracionVersion || "1")}
              disabled
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Se genera automáticamente al presentar una nueva actualización.
            </p>
          </div>
        </>
      ) : null}
      {!hideOperationalNotes ? (
        <>
          <p className="md:col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Cargá o actualizá familiares, revisá el resumen y presentá la DDJJ.
          </p>
          <p className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Solo se notificará a RRHH cuando completes la presentación final.
          </p>
        </>
      ) : null}

      {flowMode === "idle" ? (
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700">Todavía no hay una DDJJ presentada para esta persona.</p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={onStartDdjj}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Iniciar carga de DDJJ
            </button>
          </div>
        </div>
      ) : null}

      {flowMode === "view" ? (
        <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            DDJJ presentada previamente. Podés actualizar los datos cuando lo necesites.
          </div>
          {familiares
            .filter((f) =>
              [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) =>
                String(v || "").trim(),
              ),
            )
            .map((f, idx) => (
              <div key={`view-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Familiar {idx + 1}</p>
                <p>Nombre: {f.nombre || "—"} {f.apellido || ""}</p>
                <p>DNI: {f.dni || "—"}</p>
                <p>Fecha nacimiento: {formatFechaDdMmAaaa(f.fecha_nacimiento)}</p>
                <p>Parentesco: {parentescoLabelById.get(String(f.parentesco_id || "").trim()) || "—"}</p>
              </div>
            ))}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={onActualizarDdjj}
              className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Actualizar datos
            </button>
          </div>
        </div>
      ) : null}

      {(flowMode === "edit" || flowMode === "review") && form.ddjj_en_revision !== true ? (
      <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Familiares declarados</p>
          <p className="text-xs text-slate-500">Cargá un familiar por solapa.</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {familiares.map((_, idx) => (
            (() => {
              const fam = familiares[idx];
              const isComplete = familiarCompleto(fam);
              const hasData = familiarTieneDatos(fam);
              const marker = isComplete ? "Completo" : hasData ? "Falta completar" : "Sin datos";
              const statusBgClass = isComplete
                ? "bg-emerald-50 border-emerald-300"
                : hasData
                  ? "bg-amber-50 border-amber-300"
                  : "bg-slate-100 border-slate-300";
              const baseInactiveClass = `${statusBgClass} text-slate-700`;
              return (
                <button
                  key={`tab-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveIndex(idx)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    idx === activeIndex
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : baseInactiveClass
                  } disabled:opacity-60`}
                >
                  <span>{`Familiar ${idx + 1} · `}</span>
                  <span>{marker}</span>
                </button>
              );
            })()
          ))}
        </div>
        <div className="space-y-3">
          {familiares
            .filter((_, idx) => idx === activeIndex)
            .map((f, idxLocal) => {
              const idx = activeIndex + idxLocal;
              return (
            <div key={`fam-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Familiar {idx + 1}
                </p>
                {familiares.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setFamiliares((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-xs font-semibold text-rose-600 disabled:opacity-50"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("Parentesco", "parentesco_id")}</label>
                  <select
                    value={f.parentesco_id}
                    onChange={(e) => updateFam(idx, "parentesco_id", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Seleccionar...</option>
                    {optsParentesco.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {String(f.parentesco_id || "").toUpperCase() === PARENTESCO_OTROS_ID ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">{labelWithId("Detalle parentesco", "parentesco_otro_detalle")}</label>
                    <input
                      value={f.parentesco_otro_detalle || ""}
                      onChange={(e) => updateFam(idx, "parentesco_otro_detalle", e.target.value)}
                      disabled={disabled}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="Detalle del parentesco (Otros)"
                    />
                      <p className="mt-1 text-[11px] text-slate-500">Obligatorio cuando seleccionás “Otros”.</p>
                  </div>
                ) : null}
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("DNI", "dni")}</label>
                  <input
                    value={f.dni}
                    onChange={(e) => updateFam(idx, "dni", e.target.value.replace(/\D/g, ""))}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("Nombre", "nombre")}</label>
                  <input
                    value={f.nombre}
                    onChange={(e) =>
                      updateFam(idx, "nombre", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("Apellido", "apellido")}</label>
                  <input
                    value={f.apellido}
                    onChange={(e) =>
                      updateFam(idx, "apellido", e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]/g, ""))
                    }
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("Fecha de nacimiento", "fecha_nacimiento")}</label>
                  <input
                    type="date"
                    value={f.fecha_nacimiento}
                    onChange={(e) => updateFam(idx, "fecha_nacimiento", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{labelWithId("Notas del titular", "notas_titular")}</label>
                  <input
                    value={f.notas_titular}
                    onChange={(e) => updateFam(idx, "notas_titular", e.target.value)}
                    disabled={disabled}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div className="md:col-span-2 space-y-3 pt-1 text-xs text-slate-700">
                  <div className="space-y-1">
                    <p className="font-medium">Conviven en el mismo domicilio</p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`convive-${idx}`}
                          checked={f.convive === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "convive", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`convive-${idx}`}
                          checked={f.convive === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "convive", false)}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  {f.convive === false ? (
                    <div>
                      <label className="block text-xs">Domicilio del familiar</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={f.domicilio_familiar || ""}
                        onChange={(e) => updateFam(idx, "domicilio_familiar", e.target.value)}
                        disabled={disabled}
                        placeholder="Calle, número, localidad"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Obligatorio cuando no conviven en el mismo domicilio.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-medium">Dependiente</p>
                    <p className="text-[11px] text-slate-500">
                      Indica si el familiar depende económicamente del titular.
                    </p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependiente-${idx}`}
                          checked={f.dependiente === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "dependiente", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependiente-${idx}`}
                          checked={f.dependiente === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "dependiente", false)}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  {f.dependiente === true ? (
                    <div>
                      <label className="block text-xs">Detalle de dependencia</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={f.detalle_dependencia || ""}
                        onChange={(e) => updateFam(idx, "detalle_dependencia", e.target.value)}
                        disabled={disabled}
                        placeholder="Ej: sin ingresos propios"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Obligatorio cuando indicás dependencia.
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-medium">Discapacidad declarada</p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`discapacidad-${idx}`}
                          checked={f.discapacidad_declarada === true}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "discapacidad_declarada", true)}
                        />
                        Si
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name={`discapacidad-${idx}`}
                          checked={f.discapacidad_declarada === false}
                          disabled={disabled}
                          onChange={() => updateFam(idx, "discapacidad_declarada", false)}
                        />
                        No
                      </label>
                    </div>
                    {f.discapacidad_declarada === true ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Para validación final debés presentar CUD en la oficina correspondiente.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
            })}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={addOtroFamiliar}
            className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Agregar otro familiar
          </button>
        </div>
      </div>
      ) : flowMode === "review" || form.ddjj_en_revision === true ? (
      <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          Revisá los familiares cargados. Si detectás algo, podés volver a edición antes de presentar.
        </div>
        {familiares
          .filter((f) =>
            [f.parentesco_id, f.dni, f.nombre, f.apellido, f.fecha_nacimiento].some((v) => String(v || "").trim()),
          )
          .map((f, idx) => (
            <div key={`res-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">Familiar {idx + 1}</p>
              <p>Nombre: {f.nombre || "—"} {f.apellido || ""}</p>
              <p>DNI: {f.dni || "—"}</p>
              <p>Fecha nacimiento: {formatFechaDdMmAaaa(f.fecha_nacimiento)}</p>
              <p>Parentesco: {parentescoLabelById.get(String(f.parentesco_id || "").trim()) || "—"}</p>
            </div>
          ))}
        <label className="inline-flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={
              form.declaracion_jurada_aceptada === true &&
              form.consentimiento_evaluacion_rrhh === true
            }
            onChange={(e) => {
              const checked = e.target.checked;
              setField("declaracion_jurada_aceptada", checked);
              setField("consentimiento_evaluacion_rrhh", checked);
            }}
            disabled={disabled}
            className="mt-0.5"
          />
          Declaro bajo juramento que la información del grupo familiar es veraz y acepto
          que mi DDJJ será evaluada por el área correspondiente.
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setField("ddjj_en_revision", false);
              onBackToEdit();
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Volver a edición
          </button>
        </div>
      </div>
      ) : null}
    </>
  );
}
