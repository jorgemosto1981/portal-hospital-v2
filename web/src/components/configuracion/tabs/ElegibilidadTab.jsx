import ContextNote from "../ContextNote.jsx";

/**
 * Filtros de elegibilidad (`filtros_elegibilidad`): restricciones por catálogo RRHH.
 * Vacío en un eje = sin filtro en ese eje (el artículo aplica salvo otros ejes).
 */
export default function ElegibilidadTab({
  data,
  update,
  errors,
  catalogosElegibilidad,
  onRecargarCatalogos,
}) {
  const fe = errors?.fieldErrors?.filtros_elegibilidad || {};
  const raw =
    data?.filtros_elegibilidad != null && typeof data.filtros_elegibilidad === "object"
      ? data.filtros_elegibilidad
      : {};

  /** @param {string} filtrosKey */
  const idsFor = (filtrosKey) =>
    Array.isArray(raw[filtrosKey]) ? raw[filtrosKey].map(String) : [];

  /**
   * @param {string} filtrosKey
   * @param {string} id
   * @param {boolean} checked
   */
  const setIds = (filtrosKey, id, checked) => {
    const prev = idsFor(filtrosKey);
    const set = new Set(prev);
    if (checked) set.add(id);
    else set.delete(id);
    const next = [...set];
    update.section("filtros_elegibilidad", { [filtrosKey]: next });
  };

  /** @type {const} */
  const grupos = [
    {
      filtrosKey: "escalafon_ids",
      catalogKey: "escalafon",
      titulo: "Escalafón",
      efecto:
        "Solo podrán solicitar el artículo las personas con escalafón seleccionado; el resto no podrá.",
    },
    {
      filtrosKey: "agrupamiento_ids",
      catalogKey: "agrupamiento",
      titulo: "Agrupamiento",
      efecto:
        "Solo podrán solicitar el artículo las personas en agrupamientos seleccionados; el resto no podrá.",
    },
    {
      filtrosKey: "cargo_funcional_ids",
      catalogKey: "cargoFuncional",
      titulo: "Cargo funcional",
      efecto:
        "Solo podrán solicitar el artículo los cargos funcionales seleccionados; el resto no podrá.",
    },
    {
      filtrosKey: "tipo_vinculo_ids",
      catalogKey: "tipoVinculo",
      titulo: "Tipo de vínculo laboral",
      efecto:
        "Solo podrán solicitar el artículo los vínculos laborales seleccionados; el resto no podrá.",
    },
    {
      filtrosKey: "efector_ids",
      catalogKey: "efector",
      titulo: "Efector",
      efecto:
        "Solo podrán solicitar el artículo personas de efectores seleccionados; el resto no podrá.",
    },
    {
      filtrosKey: "grupo_trabajo_ids",
      catalogKey: "grupoTrabajo",
      titulo: "Grupo de trabajo",
      efecto:
        "Solo podrán solicitar el artículo personas de grupos seleccionados; el resto no podrá.",
    },
    {
      filtrosKey: "genero_ids",
      catalogKey: "genero",
      titulo: "Género (ficha)",
      efecto:
        "Solo podrán solicitar el artículo géneros seleccionados (si la norma lo requiere); el resto no podrá.",
    },
  ];
  const activos = grupos
    .map((g) => ({
      titulo: g.titulo,
      count: idsFor(g.filtrosKey).length,
    }))
    .filter((x) => x.count > 0);

  const rea =
    data?.reglas_elegibilidad_ampliada != null &&
    typeof data.reglas_elegibilidad_ampliada === "object"
      ? data.reglas_elegibilidad_ampliada
      : {};
  const situacionIds = Array.isArray(rea.situacion_revista_ids)
    ? rea.situacion_revista_ids.map(String)
    : [];
  const situacionSet = new Set(situacionIds);
  const situacionCat = catalogosElegibilidad?.situacionRevista || {
    status: "loading",
    options: [],
    error: null,
  };
  const antStr =
    typeof rea.antiguedad_minima_meses === "number" && Number.isFinite(rea.antiguedad_minima_meses)
      ? String(rea.antiguedad_minima_meses)
      : "";
  const feRea = errors?.fieldErrors?.reglas_elegibilidad_ampliada || {};

  const setSituacion = (id, checked) => {
    const s = new Set(situacionIds);
    if (checked) s.add(id);
    else s.delete(id);
    const next = [...s];
    update.section("reglas_elegibilidad_ampliada", {
      situacion_revista_ids: next.length ? next : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <p>
          Marcá uno o más valores para definir quién <strong>sí puede solicitar</strong> este artículo en
          cada eje. Quien <strong>no</strong> esté dentro de lo seleccionado, <strong>no podrá solicitarlo</strong>.
          Si dejás un bloque sin marcar nada, ese eje queda <strong>sin restricción</strong>.
        </p>
        <p className="mt-2">
          Regla por box: <strong>con selección = filtra</strong> (solo acceden los seleccionados) ·{" "}
          <strong>sin selección = no filtra</strong> (en ese box pasan todos).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onRecargarCatalogos?.()}
          className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50"
        >
          Recargar catálogos
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {grupos.map((g) => {
          const cat = catalogosElegibilidad?.[g.catalogKey] || {
            status: "loading",
            options: [],
            error: null,
          };
          const selected = new Set(idsFor(g.filtrosKey));

          return (
            <fieldset
              key={g.filtrosKey}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <legend className="px-1 text-base font-semibold text-slate-900">{g.titulo}</legend>
              <p className="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 text-xs text-blue-900">
                <strong>Efecto:</strong> {g.efecto}
              </p>
              {cat.status === "loading" ? (
                <p className="mt-2 text-sm text-slate-500">Cargando…</p>
              ) : cat.status === "error" ? (
                <p className="mt-2 text-sm text-red-700">{cat.error || "Error"}</p>
              ) : cat.options.length === 0 ? (
                <p className="mt-2 text-xs text-amber-800">No hay filas en el catálogo.</p>
              ) : (
                <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {cat.options.map((o) => (
                    <li key={o.value}>
                      <label className="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 rounded-lg px-2 py-1 text-sm text-slate-800 active:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selected.has(o.value)}
                          onChange={(e) => setIds(g.filtrosKey, o.value, e.target.checked)}
                        />
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="block">{o.label}</span>
                          <span className="font-mono text-[11px] text-slate-400">{o.value}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {fe[g.filtrosKey]?.[0] ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {fe[g.filtrosKey][0]}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Seleccionados: <strong>{selected.size}</strong>.
              </p>
            </fieldset>
          );
        })}
      </div>

      <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
        <h3 className="text-base font-semibold text-slate-900">Elegibilidad ampliada (carencia / revista)</h3>
        <p className="text-xs text-slate-600">
          Complementa los filtros de lista. La antigüedad mínima se valida en el motor contra el legajo
          (callable de antigüedad / HLC).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="antiguedad_minima_meses"
              className="block text-sm font-medium text-slate-700"
            >
              Antigüedad mínima (meses)
            </label>
            <input
              id="antiguedad_minima_meses"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              placeholder="Vacío = sin mínimo"
              value={antStr}
              onChange={(e) => {
                const t = e.target.value.trim();
                if (t === "") {
                  update.section("reglas_elegibilidad_ampliada", { antiguedad_minima_meses: undefined });
                  return;
                }
                const n = parseInt(t, 10);
                if (!Number.isFinite(n) || n < 0) return;
                update.section("reglas_elegibilidad_ampliada", { antiguedad_minima_meses: n });
              }}
            />
            {feRea.antiguedad_minima_meses?.[0] ? (
              <p className="text-sm text-red-600" role="alert">
                {feRea.antiguedad_minima_meses[0]}
              </p>
            ) : null}
          </div>
          <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              checked={rea.requiere_junta_medica_previa === true}
              onChange={(e) =>
                update.section("reglas_elegibilidad_ampliada", {
                  requiere_junta_medica_previa: e.target.checked ? true : undefined,
                })
              }
            />
            <span>
              <span className="font-medium">Requiere junta médica previa</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Distinto de auditoría médica posterior en workflow.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-800">Situación de revista</p>
          <p className="mt-1 text-xs text-slate-500">
            Referencia <span className="font-mono">cfg_situacion_revista</span>. Vacío = sin filtro en este
            eje.
          </p>
          {situacionCat.status === "loading" ? (
            <p className="mt-2 text-sm text-slate-500">Cargando…</p>
          ) : situacionCat.status === "error" ? (
            <p className="mt-2 text-sm text-red-700">{situacionCat.error}</p>
          ) : situacionCat.options.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800">Sembrá filas con seed o Configuración maestra.</p>
          ) : (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {situacionCat.options.map((o) => (
                <li key={o.value}>
                  <label className="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 rounded-lg px-2 py-1 text-sm text-slate-800 active:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={situacionSet.has(o.value)}
                      onChange={(e) => setSituacion(o.value, e.target.checked)}
                    />
                    <span>
                      {o.label}
                      <span className="block font-mono text-[11px] text-slate-400">{o.value}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ContextNote>
          Si el legajo aún no expone situación de revista en HLC, el motor puede omitir este eje hasta
          alinear datos laborales.
        </ContextNote>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen final de impacto (Elegibilidad)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          {activos.length === 0 ? (
            <li>
              Filtros base: <strong>sin restricción</strong> por escalafón/agrupamiento/cargo/vínculo/efector/
              grupo/género en esta configuración.
            </li>
          ) : (
            <>
              {activos.map((a) => (
                <li key={a.titulo}>
                  <strong>{a.titulo}:</strong> {a.count} selección(es) habilitadas para solicitar.
                </li>
              ))}
              <li>
                Regla aplicada: quien no esté dentro de estas selecciones activas, no podrá solicitar el
                artículo.
              </li>
              <li>
                Combinación final: se aplica <strong>AND</strong> entre boxes que filtran; un box vacío no
                bloquea (equivale a “todos” en ese eje).
              </li>
            </>
          )}
          {rea.antiguedad_minima_meses != null ? (
            <li>
              Antigüedad mínima declarada: <strong>{rea.antiguedad_minima_meses}</strong> meses (validación en
              motor).
            </li>
          ) : null}
          {situacionIds.length > 0 ? (
            <li>
              Situación de revista: <strong>{situacionIds.length}</strong> fila(s) permitida(s).
            </li>
          ) : null}
          {rea.requiere_junta_medica_previa ? (
            <li>
              Junta médica <strong>previa</strong> requerida antes del alta de la licencia.
            </li>
          ) : null}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        La lista de <strong>artículos incompatibles</strong> entre sí se configura en la pestaña{" "}
        <strong>Workflow</strong>. El campo <span className="font-mono">excluye_ids</span> dentro de{" "}
        filtros queda reservado para una definición futura con RRHH (semántica frente a catálogos).
      </p>
    </div>
  );
}
