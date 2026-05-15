import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCatalogosArticulos } from "../hooks/useCatalogosArticulos.js";
import { loadArticuloVersionesList } from "../services/articuloVersionesListService.js";

function estadoLabel(estadoVersionId, getOptions) {
  const id = String(estadoVersionId || "").trim();
  if (!id) return "—";
  const opts = getOptions("cfg_estado_version_articulo");
  const hit = opts.find((o) => o.value === id);
  return hit?.label || id;
}

const btnPrimary =
  "inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2";

const btnSecondary =
  "inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2";

export default function ArticuloVersionesListado() {
  const navigate = useNavigate();
  const { articuloId } = useParams();
  const { getOptions, loading: catalogosLoading } = useCatalogosArticulos([
    "cfg_estado_version_articulo",
  ]);

  const [articulo, setArticulo] = useState(null);
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const artIdValido = /^art_[0-9A-HJKMNP-TV-Z]{26}$/i.test(articuloId ?? "");

  const fetchData = useCallback(async () => {
    if (!artIdValido) {
      setError("ID de artículo inválido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await loadArticuloVersionesList(articuloId);
      setArticulo(data.articulo);
      setVersiones(data.versiones);
    } catch (err) {
      setArticulo(null);
      setVersiones([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar las versiones.");
    } finally {
      setLoading(false);
    }
  }, [articuloId, artIdValido]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const tituloArticulo = useMemo(() => {
    if (!articulo) return "Artículo";
    const cod = articulo.codigo || "—";
    const nom = articulo.nombre || "Sin nombre";
    return `${cod} — ${nom}`;
  }, [articulo]);

  const abrirConfig = (versionId) => {
    navigate(`/portal/rrhh/configuracion-articulos/${articuloId}?versionId=${encodeURIComponent(versionId)}`);
  };

  if (!artIdValido) {
    return (
      <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 p-4">
        <p className="text-sm text-red-700">El identificador del artículo no es válido.</p>
        <button type="button" onClick={() => navigate("/portal/rrhh/configuracion-articulos")} className={btnSecondary}>
          Volver al listado
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/portal/rrhh/configuracion-articulos")}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-transform active:scale-95"
            aria-label="Volver al listado"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Versiones del artículo</h1>
            <p className="mt-1 text-sm font-medium text-slate-800">{tituloArticulo}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{articuloId}</p>
          </div>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-500">
          Todas las versiones guardadas en Firestore. La fila <strong className="font-medium text-slate-700">Actual</strong>{" "}
          coincide con <span className="font-mono text-xs">version_actual_id</span> del núcleo (última guardada).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                `/portal/rrhh/configuracion-articulos/${articuloId}` +
                  (articulo?.versionActualId ? `?versionId=${articulo.versionActualId}` : ""),
              )
            }
            className={btnSecondary}
          >
            Gestionar versión actual
          </button>
          <button type="button" onClick={fetchData} disabled={loading} className={btnSecondary}>
            Actualizar lista
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex justify-center py-12">
          <span className="text-sm text-slate-400">Cargando versiones…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && versiones.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No hay versiones en la subcolección <span className="font-mono">versiones</span>.
        </div>
      )}

      {!loading && !error && versiones.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Versión</th>
                <th className="px-4 py-3">Estado</th>
                <th className="hidden px-4 py-3 sm:table-cell">Semántica</th>
                <th className="px-4 py-3">Año fiscal</th>
                <th className="hidden px-4 py-3 md:table-cell">Publicada</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versiones.map((ver) => {
                const esActual = articulo?.versionActualId === ver.versionId;
                const verCorta = `…${ver.versionId.slice(-8)}`;
                return (
                  <tr
                    key={ver.versionId}
                    className={esActual ? "bg-blue-50/40" : "transition-colors active:bg-slate-50"}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-slate-800" title={ver.versionId}>
                          {verCorta}
                        </span>
                        {esActual ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                            Actual
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {catalogosLoading ? "…" : estadoLabel(ver.estadoVersionId, getOptions)}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{ver.versionSemantica}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {ver.correspondenciaAnio != null ? (
                        <span className="font-semibold tabular-nums">{ver.correspondenciaAnio}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                      {ver.publicadaEn || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => abrirConfig(ver.versionId)} className={btnPrimary}>
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
