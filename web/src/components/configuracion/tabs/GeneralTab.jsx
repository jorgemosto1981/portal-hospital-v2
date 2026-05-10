import { useMemo } from "react";

import ContextNote from "../ContextNote.jsx";
import {
  parseArticuloBorrador,
  parseArticuloPublicable,
} from "../../../utils/articulos/articuloFormValidation.js";

/**
 * Errores por índice de fila SARH (path Zod variantes_sarh.i.campo).
 * @param {unknown} data
 * @returns {Map<number, Record<string, string>>}
 */
function mapIssuesVariantesPorIndice(data) {
  const r = parseArticuloBorrador(data);
  if (r.success) return new Map();
  /** @type {Map<number, Record<string, string>>} */
  const map = new Map();
  for (const issue of r.error.issues) {
    const p = issue.path;
    if (p[0] !== "variantes_sarh" || typeof p[1] !== "number") continue;
    const idx = p[1];
    const field = p[2];
    if (typeof field !== "string") continue;
    if (!map.has(idx)) map.set(idx, {});
    const row = map.get(idx);
    if (row) row[field] = issue.message;
  }
  return map;
}

/**
 * Mensaje cuando falla el array completo (p. ej. .min(1) en raíz).
 * @param {unknown} data
 */
function mensajeErrorArrayVariantes(data) {
  const r = parseArticuloBorrador(data);
  if (r.success) return null;
  for (const issue of r.error.issues) {
    const p = issue.path;
    if (p.length === 1 && p[0] === "variantes_sarh") return issue.message;
  }
  return null;
}

/**
 * Identidad, normativa, clasificación y vigencia (Bento). Catálogos vía props del orquestador.
 * @param {{
 *   data: Record<string, unknown>,
 *   update: { field: Function, section: Function, variante: Function, varianteAgregar?: Function, varianteEliminar?: Function },
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

  const variantes = Array.isArray(data.variantes_sarh) ? data.variantes_sarh : [];
  const issuesPorFila = mapIssuesVariantesPorIndice(data);
  const errorListaVariantes = mensajeErrorArrayVariantes(data);
  const activasCount = variantes.filter((v) => v && v.activo === true).length;

  const avisoPublicacionVariantes = useMemo(() => {
    if (!parseArticuloBorrador(data).success) return null;
    const p = parseArticuloPublicable(data);
    if (p.success) return null;
    const issue = p.error.issues.find((i) => i.path[0] === "variantes_sarh");
    return issue?.message ?? null;
  }, [data]);

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

      <section className={bloqueClass} aria-labelledby="bloque-variantes-sarh">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="bloque-variantes-sarh" className="text-base font-semibold text-slate-900">
              Variantes SARH
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Un decreto puede mapear a varios códigos SARH. Publicar exige al menos una variante con{" "}
              <strong>activo</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update.varianteAgregar()}
            className="min-h-11 shrink-0 touch-manipulation rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 outline-none ring-blue-500 focus-visible:ring-2 active:bg-blue-100"
          >
            Agregar variante
          </button>
        </div>

        {errorListaVariantes ? (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {errorListaVariantes}
          </p>
        ) : null}

        <ul className="space-y-4">
          {variantes.map((row, index) => {
            const rowIssues = issuesPorFila.get(index) || {};
            const codigo =
              typeof row?.codigo_sarh === "string" ? row.codigo_sarh : "";
            const etiqueta = typeof row?.etiqueta_ui === "string" ? row.etiqueta_ui : "";
            const pct =
              typeof row?.afecta_sueldo_porcentaje === "number" &&
              Number.isFinite(row.afecta_sueldo_porcentaje)
                ? row.afecta_sueldo_porcentaje
                : 0;
            const activoVar = row?.activo === true;

            return (
              <li
                key={`sarh-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    Variante {index + 1}
                  </span>
                  <button
                    type="button"
                    disabled={variantes.length <= 1}
                    onClick={() => update.varianteEliminar(index)}
                    className="min-h-11 touch-manipulation rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 outline-none ring-red-500 focus-visible:ring-2 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Quitar variante
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Código SARH
                    </span>
                    <input
                      type="text"
                      value={codigo}
                      onChange={(e) =>
                        update.variante(index, { codigo_sarh: e.target.value })
                      }
                      autoComplete="off"
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                    />
                    {rowIssues.codigo_sarh ? (
                      <span className="mt-1 block text-sm text-red-600" role="alert">
                        {rowIssues.codigo_sarh}
                      </span>
                    ) : null}
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Etiqueta en pantalla
                    </span>
                    <input
                      type="text"
                      value={etiqueta}
                      onChange={(e) =>
                        update.variante(index, { etiqueta_ui: e.target.value })
                      }
                      autoComplete="off"
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                    />
                    {rowIssues.etiqueta_ui ? (
                      <span className="mt-1 block text-sm text-red-600" role="alert">
                        {rowIssues.etiqueta_ui}
                      </span>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      % afectación de sueldo
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={1}
                      value={pct}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        update.variante(
                          index,
                          Number.isFinite(n)
                            ? { afecta_sueldo_porcentaje: n }
                            : { afecta_sueldo_porcentaje: 0 },
                        );
                      }}
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
                    />
                    {rowIssues.afecta_sueldo_porcentaje ? (
                      <span className="mt-1 block text-sm text-red-600" role="alert">
                        {rowIssues.afecta_sueldo_porcentaje}
                      </span>
                    ) : null}
                  </label>
                  <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm sm:mt-7">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      checked={activoVar}
                      onChange={(e) =>
                        update.variante(index, { activo: e.target.checked })
                      }
                    />
                    <span className="font-medium">Variante activa</span>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>

        <ContextNote>
          En solicitudes, si aplica, el código debe existir entre las variantes <strong>activas</strong>. Para
          publicar el artículo hace falta <strong>al menos una variante activa</strong>.
        </ContextNote>
        {avisoPublicacionVariantes ? (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            role="status"
          >
            <strong>Publicación:</strong> {avisoPublicacionVariantes}
          </p>
        ) : null}
      </section>

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
              hint="Catálogo cfg_tipo_norma_principal_articulo — clase de fuente normativa citada (ley, decreto, etc.)."
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
            Variantes SARH:{" "}
            <strong>
              {variantes.length} fila(s), {activasCount} activa(s)
            </strong>
            .
          </li>
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
