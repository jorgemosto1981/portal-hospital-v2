import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ContextNote from "../components/configuracion/ContextNote.jsx";
import { listarArticulosCfgResumen } from "../services/articulosCfgService.js";

function formatoFecha(v) {
  if (v && typeof v.toDate === "function") {
    try {
      return v.toDate().toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "—";
    }
  }
  return "—";
}

export default function ArticulosCfgLista() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState(
    /** @type {'todos' | 'activos' | 'inactivos'} */ ("todos"),
  );
  const [orden, setOrden] = useState(
    /** @type {'actualizado_desc' | 'titulo_asc' | 'titulo_desc'} */ ("actualizado_desc"),
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const list = await listarArticulosCfgResumen();
      setFilas(list);
    } catch (e) {
      setError(e?.message || "No se pudo cargar la lista.");
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filasVisibles = useMemo(() => {
    let x = filas;
    if (filtroActivo === "activos") x = x.filter((r) => r.activo);
    if (filtroActivo === "inactivos") x = x.filter((r) => !r.activo);
    const q = busqueda.trim().toLowerCase();
    if (q) {
      x = x.filter(
        (r) =>
          r.titulo.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q),
      );
    }
    const sorted = [...x];
    if (orden === "titulo_asc") {
      sorted.sort((a, b) =>
        (a.titulo || "").localeCompare(b.titulo || "", "es", { sensitivity: "base" }),
      );
    } else if (orden === "titulo_desc") {
      sorted.sort((a, b) =>
        (b.titulo || "").localeCompare(a.titulo || "", "es", { sensitivity: "base" }),
      );
    } else {
      sorted.sort((a, b) => {
        const ma =
          a.actualizado_en && typeof a.actualizado_en.toMillis === "function"
            ? a.actualizado_en.toMillis()
            : 0;
        const mb =
          b.actualizado_en && typeof b.actualizado_en.toMillis === "function"
            ? b.actualizado_en.toMillis()
            : 0;
        return mb - ma;
      });
    }
    return sorted;
  }, [filas, filtroActivo, busqueda, orden]);

  const hayDatos = filas.length > 0;
  const listaVaciaPorFiltro = hayDatos && filasVisibles.length === 0;

  return (
    <div className="min-h-[calc(100dvh-6rem)] bg-slate-50 px-3 py-6 md:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-100 bg-white p-4 shadow-xl md:p-8">
        <header className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Artículos</h1>
            <p className="mt-1 text-sm text-slate-500">
              Definiciones en <span className="font-mono text-slate-600">cfg_articulos</span>. Elegí uno
              para editar o creá uno nuevo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              className="min-h-11 touch-manipulation rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 outline-none ring-blue-500 focus-visible:ring-2 active:bg-slate-50 disabled:opacity-50"
            >
              Recargar lista
            </button>
            <Link
              to="/portal/rrhh/configuracion-articulos/nuevo"
              className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm outline-none ring-blue-500 focus-visible:ring-2 active:bg-blue-700"
            >
              Nuevo artículo
            </Link>
          </div>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Buscar</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Título o id del documento"
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Estado</span>
            <select
              value={filtroActivo}
              onChange={(e) =>
                setFiltroActivo(/** @type {'todos' | 'activos' | 'inactivos'} */ (e.target.value))
              }
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
            >
              <option value="todos">Todos</option>
              <option value="activos">Solo activos</option>
              <option value="inactivos">Solo inactivos</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Orden</span>
            <select
              value={orden}
              onChange={(e) =>
                setOrden(
                  /** @type {'actualizado_desc' | 'titulo_asc' | 'titulo_desc'} */ (e.target.value),
                )
              }
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none ring-blue-500 focus-visible:ring-2 touch-manipulation"
            >
              <option value="actualizado_desc">Última actualización</option>
              <option value="titulo_asc">Título A → Z</option>
              <option value="titulo_desc">Título Z → A</option>
            </select>
          </label>
        </div>

        <ContextNote className="mt-4">
          La búsqueda y el filtro por estado recortan solo esta vista en el navegador; no modifican
          Firestore. El orden aplica a las filas ya cargadas (actualización según timestamp del documento
          cuando elegís &quot;Última actualización&quot;).
        </ContextNote>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-3">Título</th>
                <th className="pb-3 pr-3">Estado</th>
                <th className="hidden pb-3 sm:table-cell">Actualizado</th>
                <th className="pb-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : !hayDatos ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    No hay artículos. Creá uno con &quot;Nuevo artículo&quot;.
                  </td>
                </tr>
              ) : listaVaciaPorFiltro ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-600">
                    Ningún artículo coincide con la búsqueda o el filtro. Probá otras palabras o cambiá el
                    estado.
                  </td>
                </tr>
              ) : (
                filasVisibles.map((r) => (
                  <tr key={r.id} className="bg-white">
                    <td className="max-w-[200px] py-3 pr-3 md:max-w-md">
                      <p className="font-medium text-slate-900">{r.titulo || "(sin título)"}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{r.id}</p>
                    </td>
                    <td className="py-3 pr-3">
                      {r.activo ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="hidden py-3 text-slate-600 sm:table-cell">{formatoFecha(r.actualizado_en)}</td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/portal/rrhh/configuracion-articulos/${r.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-blue-600 outline-none ring-blue-500 focus-visible:ring-2 active:bg-blue-50"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hayDatos && !cargando ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Mostrando <strong>{filasVisibles.length}</strong> de <strong>{filas.length}</strong> artículo(s).
          </p>
        ) : null}
      </div>
    </div>
  );
}
