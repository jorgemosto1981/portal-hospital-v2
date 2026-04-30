import {
  SECCIONES_CATALOGO_RRHH,
} from "../constants/configuracionCatalogos.js";
import {
  formatVigenciaCell,
  labelProvinciaEnTabla,
} from "../features/configuracion/configuracionFormatters.js";
import { useConfiguracionCatalogos } from "../features/configuracion/hooks/useConfiguracionCatalogos.js";
import { sugerirIdCatalogo } from "../utils/catalogoId.js";

export default function Configuracion() {
  const {
    user,
    isRrhh,
    openAccessTemp,
    canReadCatalogos,
    canWriteCatalogos,
    selectedKey,
    setSelectedKey,
    itemActual,
    rows,
    loading,
    loadError,
    modal,
    setModal,
    addNombre,
    addId,
    editNombre,
    editActivo,
    editVigDesde,
    editVigHasta,
    editDocId,
    provincias,
    addProvinciaId,
    editProvinciaId,
    setEditNombre,
    setEditActivo,
    setEditVigDesde,
    setEditVigHasta,
    setAddProvinciaId,
    setEditProvinciaId,
    isLocalidad,
    tituloPanel,
    accesoBloqueado,
    abrirAgregar,
    abrirEditar,
    onAddNombreChange,
    onAddIdChange,
    guardarNuevo,
    guardarEdicion,
  } = useConfiguracionCatalogos();

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          Configuración maestra
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
          Catálogos institucionales en vivo. Solo cuentas con rol{" "}
          <span className="font-mono text-slate-700">portal_role: &quot;rrhh&quot;</span> pueden listar y
          guardar.
        </p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
          <p><strong>Objetivo:</strong> administrar catálogos institucionales cfg_* en una sola pantalla.</p>
          <p><strong>Resultado:</strong> opciones vigentes para formularios RRHH, personales y laborales.</p>
          <p><strong>Cuándo usar:</strong> altas, bajas lógicas o ajustes de catálogos maestros.</p>
        </div>
        {openAccessTemp && (
          <p className="mt-2 text-xs text-amber-700">
            Modo temporal activo: lectura de catálogos habilitada sin login RRHH.
          </p>
        )}
      </header>

      {accesoBloqueado && (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          {!user
            ? "Iniciá sesión en el portal con una cuenta de RRHH para administrar catálogos."
            : "Tu usuario no tiene permiso RRHH. Pedí la asignación del claim en consola o al equipo técnico."}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Menú lateral / selector móvil */}
        <div className="shrink-0 lg:w-60">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm lg:p-4">
            <p className="hidden px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:block">
              Categorías
            </p>
            <label className="mb-2 block text-xs font-medium text-slate-600 lg:hidden" htmlFor="cat-select">
              Categoría
            </label>
            <select
              id="cat-select"
              className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none ring-blue-600 focus:ring-2 lg:hidden"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {SECCIONES_CATALOGO_RRHH.flatMap((sec) =>
                sec.items.map((it) => (
                  <option key={it.key} value={it.key}>
                    {sec.titulo}: {it.etiqueta}
                  </option>
                )),
              )}
            </select>
            <nav className="hidden space-y-5 lg:block" aria-label="Secciones de catálogo">
              {SECCIONES_CATALOGO_RRHH.map((sec) => (
                <div key={sec.id}>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {sec.titulo}
                  </p>
                  <ul className="space-y-0.5">
                    {sec.items.map((it) => {
                      const active = it.key === selectedKey;
                      return (
                        <li key={it.key}>
                          <button
                            type="button"
                            onClick={() => setSelectedKey(it.key)}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                              active
                                ? "bg-blue-600 font-semibold text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {it.etiqueta}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Panel principal */}
        <section className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{tituloPanel}</h2>
              <p className="mt-0.5 font-mono text-xs text-slate-400">{itemActual.collectionName}</p>
            </div>
            <button
              type="button"
              disabled={!canWriteCatalogos}
              onClick={abrirAgregar}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agregar nuevo
            </button>
          </div>

          {loadError && (
            <p className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 md:px-5">
              {loadError}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 md:px-5">ID</th>
                  <th className="px-4 py-3 md:px-5">Nombre</th>
                  {isLocalidad && (
                    <th className="px-4 py-3 md:px-5">Provincia</th>
                  )}
                  <th className="px-4 py-3 md:px-5">Estado</th>
                  <th className="hidden px-4 py-3 sm:table-cell md:px-5">Vigencia</th>
                  <th className="px-4 py-3 text-right md:px-5"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td
                      colSpan={isLocalidad ? 6 : 5}
                      className="px-4 py-10 text-center text-slate-500 md:px-5"
                    >
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && !canReadCatalogos && (
                  <tr>
                    <td
                      colSpan={isLocalidad ? 6 : 5}
                      className="px-4 py-10 text-center text-slate-500 md:px-5"
                    >
                      Iniciá sesión con RRHH para ver esta colección.
                    </td>
                  </tr>
                )}
                {!loading && canReadCatalogos && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={isLocalidad ? 6 : 5}
                      className="px-4 py-10 text-center text-slate-500 md:px-5"
                    >
                      No hay documentos en esta colección.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row) => (
                    <tr key={row.id} className="bg-white transition-colors hover:bg-slate-50/80">
                      <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-slate-700 md:max-w-xs md:px-5">
                        {row.id}
                      </td>
                      <td className="px-4 py-3 text-slate-800 md:px-5">{row.nombre ?? "—"}</td>
                      {isLocalidad && (
                        <td className="max-w-[160px] px-4 py-3 text-sm text-slate-700 md:px-5">
                          {labelProvinciaEnTabla(provincias, row.provincia_id)}
                          {row.provincia_id && (
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                              {row.provincia_id}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 md:px-5">
                        {row.activo !== false ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 sm:table-cell md:px-5">
                        {formatVigenciaCell(row)}
                      </td>
                      <td className="px-4 py-3 text-right md:px-5">
                        <button
                          type="button"
                          disabled={!canWriteCatalogos}
                          onClick={() => abrirEditar(row)}
                          className="rounded-lg px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal agregar */}
      {modal === "agregar" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModal("cerrado");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-agregar-titulo"
            className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="modal-agregar-titulo" className="text-lg font-semibold text-slate-900">
              Nueva opción
            </h3>
            <p className="mt-1 text-xs text-slate-500">{itemActual.collectionName}</p>
            <form className="mt-4 space-y-4" onSubmit={guardarNuevo}>
              <div>
                <label className="block text-xs font-medium text-slate-600" htmlFor="add-nombre">
                  Nombre
                </label>
                <input
                  id="add-nombre"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
                  value={addNombre}
                  onChange={(e) => onAddNombreChange(e.target.value)}
                  placeholder="Ej. Planta permanente"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600" htmlFor="add-id">
                  ID (mayúsculas)
                </label>
                <input
                  id="add-id"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none ring-blue-600 focus:ring-2"
                  value={addId}
                  onChange={(e) => onAddIdChange(e.target.value)}
                  placeholder={sugerirIdCatalogo(itemActual.idPrefix, "Ejemplo")}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Sugerido desde el nombre. Podés ajustarlo antes de guardar.
                </p>
              </div>
              {isLocalidad && (
                <div>
                  <label
                    className="block text-xs font-medium text-slate-600"
                    htmlFor="add-provincia"
                  >
                    Provincia
                  </label>
                  <select
                    id="add-provincia"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
                    value={addProvinciaId}
                    onChange={(e) => setAddProvinciaId(e.target.value)}
                  >
                    <option value="">Elegir provincia…</option>
                    {provincias.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre ?? p.id}
                      </option>
                    ))}
                  </select>
                  {provincias.length === 0 && (
                    <p className="mt-1 text-xs text-amber-800">
                      Cargá provincias en el catálogo «Provincias» y volvé a intentar.
                    </p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => setModal("cerrado")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {modal === "editar" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setModal("cerrado");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-editar-titulo"
            className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="modal-editar-titulo" className="text-lg font-semibold text-slate-900">
              Editar opción
            </h3>
            <p className="mt-1 font-mono text-xs text-slate-500">{editDocId}</p>
            <form className="mt-4 space-y-4" onSubmit={guardarEdicion}>
              <div>
                <label className="block text-xs font-medium text-slate-600" htmlFor="edit-nombre">
                  Nombre
                </label>
                <input
                  id="edit-nombre"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                />
              </div>
              {isLocalidad && (
                <div>
                  <label
                    className="block text-xs font-medium text-slate-600"
                    htmlFor="edit-provincia"
                  >
                    Provincia
                  </label>
                  <select
                    id="edit-provincia"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-600 focus:ring-2"
                    value={editProvinciaId}
                    onChange={(e) => setEditProvinciaId(e.target.value)}
                  >
                    <option value="">Elegir provincia…</option>
                    {provincias.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre ?? p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                />
                Activo (visible en nuevas altas)
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600" htmlFor="edit-desde">
                    Vigente desde
                  </label>
                  <input
                    id="edit-desde"
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2"
                    value={editVigDesde}
                    onChange={(e) => setEditVigDesde(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600" htmlFor="edit-hasta">
                    Vigente hasta
                  </label>
                  <input
                    id="edit-hasta"
                    type="date"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-blue-600 focus:ring-2"
                    value={editVigHasta}
                    onChange={(e) => setEditVigHasta(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">Dejá las fechas vacías para vigencia abierta (null).</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => setModal("cerrado")}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
