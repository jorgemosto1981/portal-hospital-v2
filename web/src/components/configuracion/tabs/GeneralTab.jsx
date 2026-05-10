/**
 * Identidad, normativa, clasificación y vigencia (Bento). Catálogos vía props del orquestador.
 * @param {{
 *   data: Record<string, unknown>,
 *   update: { field: (key: string, value: unknown) => void, section: Function, variante: Function },
 *   errors: import("zod").ZodFormattedError<unknown> | null,
 *   catalogoTipoArticulo: { status: string, options: { value: string, label: string }[], error: string | null },
 *   catalogoUnidadMedida: { status: string, options: { value: string, label: string }[], error: string | null },
 *   catalogoNormaPrincipalTipo: { status: string, options: { value: string, label: string }[], error: string | null },
 *   onRecargarCatalogos?: () => void,
 * }} p
 */
function CatalogSelect({
  id,
  label,
  hint,
  catalogo,
  value,
  onChange,
  fieldError,
  emptyLabel = "Sin selección",
}) {
  const disabled = catalogo.status === "loading";

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {catalogo.status === "loading" ? (
        <p className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Cargando opciones…
        </p>
      ) : catalogo.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <p>Error al cargar: {catalogo.error || "desconocido"}</p>
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation disabled:opacity-60"
        >
          <option value="">{emptyLabel}</option>
          {catalogo.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {catalogo.status === "ok" && catalogo.options.length === 0 ? (
        <p className="text-xs text-amber-700">No hay opciones en el catálogo.</p>
      ) : null}
      {fieldError ? (
        <span className="block text-sm text-red-600" role="alert">
          {fieldError}
        </span>
      ) : null}
    </div>
  );
}

function ContextNote({ children }) {
  return (
    <p className="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2 py-1 text-xs text-blue-900">
      <strong>Efecto:</strong> {children}
    </p>
  );
}

export default function GeneralTab({
  data,
  update,
  errors,
  catalogoTipoArticulo,
  catalogoUnidadMedida,
  catalogoNormaPrincipalTipo,
  onRecargarCatalogos,
}) {
  const fe = errors?.fieldErrors || {};

  const titulo = typeof data.titulo === "string" ? data.titulo : "";
  const descripcion =
    typeof data.descripcion_operativa === "string" ? data.descripcion_operativa : "";
  const normaRef =
    typeof data.norma_principal_referencia === "string" ? data.norma_principal_referencia : "";
  const inciso = typeof data.inciso_normativo === "string" ? data.inciso_normativo : "";

  const tipoId = typeof data.tipo_articulo_id === "string" ? data.tipo_articulo_id : "";
  const umId = typeof data.unidad_medida_id === "string" ? data.unidad_medida_id : "";
  const normaTipoId =
    typeof data.norma_principal_tipo_id === "string" ? data.norma_principal_tipo_id : "";
  const tipoLabel = catalogoTipoArticulo.options.find((o) => o.value === tipoId)?.label || null;
  const umLabel = catalogoUnidadMedida.options.find((o) => o.value === umId)?.label || null;
  const normaTipoLabel =
    catalogoNormaPrincipalTipo.options.find((o) => o.value === normaTipoId)?.label || null;

  const vigDesde =
    data.vigente_desde == null ? "" : String(data.vigente_desde).slice(0, 10);
  const vigHasta =
    data.vigente_hasta == null ? "" : String(data.vigente_hasta).slice(0, 10);

  const setOptionalId = (key, raw) => {
    const v = String(raw || "").trim();
    update.field(key, v.length ? v : undefined);
  };

  const bloqueClass =
    "rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 shadow-sm md:p-5";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Datos generales del artículo. Los catálogos se cargan desde el servidor.
        </p>
        {typeof onRecargarCatalogos === "function" ? (
          <button
            type="button"
            onClick={() => onRecargarCatalogos()}
            className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50"
          >
            Recargar catálogos
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={bloqueClass} aria-labelledby="bloque-identidad">
          <h2 id="bloque-identidad" className="mb-3 text-base font-semibold text-slate-900">
            Identidad
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Título</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => update.field("titulo", e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                autoComplete="off"
              />
              {fe.titulo?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.titulo[0]}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Descripción operativa</span>
              <textarea
                value={descripcion}
                onChange={(e) => update.field("descripcion_operativa", e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              />
              {fe.descripcion_operativa?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.descripcion_operativa[0]}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section className={bloqueClass} aria-labelledby="bloque-normativa">
          <h2 id="bloque-normativa" className="mb-3 text-base font-semibold text-slate-900">
            Normativa
          </h2>
          <div className="space-y-4">
            <CatalogSelect
              id="norma_principal_tipo_id"
              label="Tipo de norma / acto"
              hint="Catálogo cfg_tipo_acto_designación (provisorio hasta colección dedicada norma_principal)."
              catalogo={catalogoNormaPrincipalTipo}
              value={normaTipoId}
              onChange={(v) => setOptionalId("norma_principal_tipo_id", v)}
              fieldError={fe.norma_principal_tipo_id?.[0]}
            />
            {normaTipoLabel ? (
              <ContextNote>
                El artículo se interpreta bajo la tipología normativa <strong>{normaTipoLabel}</strong>.
              </ContextNote>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Referencia normativa</span>
              <input
                type="text"
                value={normaRef}
                onChange={(e) => update.field("norma_principal_referencia", e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                autoComplete="off"
              />
              {fe.norma_principal_referencia?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.norma_principal_referencia[0]}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Inciso</span>
              <input
                type="text"
                value={inciso}
                onChange={(e) => update.field("inciso_normativo", e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                autoComplete="off"
              />
              {fe.inciso_normativo?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.inciso_normativo[0]}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section className={bloqueClass} aria-labelledby="bloque-clasificacion">
          <h2 id="bloque-clasificacion" className="mb-3 text-base font-semibold text-slate-900">
            Clasificación
          </h2>
          <div className="space-y-4">
            <CatalogSelect
              id="tipo_articulo_id"
              label="Tipo de artículo"
              catalogo={catalogoTipoArticulo}
              value={tipoId}
              onChange={(v) => setOptionalId("tipo_articulo_id", v)}
              fieldError={fe.tipo_articulo_id?.[0]}
            />
            {tipoLabel ? (
              <ContextNote>
                Se comporta como <strong>{tipoLabel}</strong> para reglas operativas y reportes.
              </ContextNote>
            ) : null}
            <CatalogSelect
              id="unidad_medida_id"
              label="Unidad de medida"
              catalogo={catalogoUnidadMedida}
              value={umId}
              onChange={(v) => setOptionalId("unidad_medida_id", v)}
              fieldError={fe.unidad_medida_id?.[0]}
            />
            {umLabel ? (
              <ContextNote>
                Las cantidades del artículo se expresan en <strong>{umLabel}</strong>.
              </ContextNote>
            ) : null}
          </div>
        </section>

        <section className={bloqueClass} aria-labelledby="bloque-vigencia">
          <h2 id="bloque-vigencia" className="mb-3 text-base font-semibold text-slate-900">
            Vigencia
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Vigente desde</span>
              <input
                type="date"
                value={vigDesde}
                onChange={(e) =>
                  update.field("vigente_desde", e.target.value ? e.target.value : null)
                }
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              />
              {fe.vigente_desde?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.vigente_desde[0]}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Vigente hasta</span>
              <input
                type="date"
                value={vigHasta}
                onChange={(e) =>
                  update.field("vigente_hasta", e.target.value ? e.target.value : null)
                }
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
              />
              {fe.vigente_hasta?.[0] ? (
                <span className="mt-1 block text-sm text-red-600" role="alert">
                  {fe.vigente_hasta[0]}
                </span>
              ) : null}
            </label>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <h3 className="text-sm font-semibold text-emerald-900">Resumen final de impacto (General)</h3>
        <ul className="mt-2 space-y-1 text-sm text-emerald-900">
          <li>
            Normativa:{" "}
            <strong>{normaTipoLabel || "sin tipología seleccionada"}</strong>
            {normaRef ? ` · Ref. ${normaRef}` : ""}
            {inciso ? ` · Inciso ${inciso}` : ""}
          </li>
          <li>
            Clasificación: <strong>{tipoLabel || "sin tipo"}</strong> · Unidad{" "}
            <strong>{umLabel || "sin unidad"}</strong>.
          </li>
          <li>
            Vigencia: desde <strong>{vigDesde || "abierta"}</strong> hasta{" "}
            <strong>{vigHasta || "abierta"}</strong>.
          </li>
        </ul>
      </section>
    </div>
  );
}
