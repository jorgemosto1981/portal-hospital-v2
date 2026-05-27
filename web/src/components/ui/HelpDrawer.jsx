import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { GLOSARIO_COMPLETO, resolverAyudaContextual } from "../../constants/helpContent.js";

/**
 * Drawer lateral de ayuda contextual.
 * Se abre desde la derecha, muestra manual + glosario relevante según la ruta actual.
 * Tabs: "Manual" (si hay contenido para la ruta) y "Glosario".
 */
export default function HelpDrawer({ abierto, onCerrar, focoTermino = "" }) {
  const { pathname } = useLocation();
  const [tab, setTab] = useState("manual");
  const [busqueda, setBusqueda] = useState("");

  const { manual, glosarioFiltrado } = useMemo(() => resolverAyudaContextual(pathname), [pathname]);

  const glosarioMostrado = useMemo(() => {
    const base = tab === "glosario" ? GLOSARIO_COMPLETO : glosarioFiltrado;
    if (!busqueda.trim()) return base;
    const q = busqueda.toLowerCase().trim();
    return base.filter(
      (g) => g.termino.toLowerCase().includes(q) || g.definicion.toLowerCase().includes(q),
    );
  }, [tab, glosarioFiltrado, busqueda]);

  const tabActual = manual ? tab : "glosario";

  useEffect(() => {
    if (!abierto) return;
    const termino = String(focoTermino || "").trim();
    if (!termino) return;
    setTab("glosario");
    setBusqueda(termino);
  }, [abierto, focoTermino]);

  if (!abierto) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[70] bg-black/30 transition-opacity"
        onClick={onCerrar}
        aria-hidden
      />

      {/* Drawer */}
      <aside className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col bg-white shadow-2xl sm:max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-900">Ayuda</h2>
          </div>
          <button
            onClick={onCerrar}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5">
          {manual && (
            <button
              type="button"
              onClick={() => { setTab("manual"); setBusqueda(""); }}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tabActual === "manual"
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Manual
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("glosario")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tabActual === "glosario"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Glosario{tabActual === "manual" && glosarioFiltrado.length > 0 ? ` (${glosarioFiltrado.length})` : ""}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Manual */}
          {tabActual === "manual" && manual && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{manual.titulo}</h3>
                <span className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {manual.rol}
                </span>
              </div>

              <div className="space-y-3">
                {manual.pasos.map((paso, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-1.5 flex items-start gap-2">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-800">{paso.titulo}</h4>
                    </div>
                    <p className="ml-8 text-sm leading-relaxed text-slate-600">{paso.contenido}</p>
                  </div>
                ))}
              </div>

              {/* Glosario relevante inline */}
              {glosarioFiltrado.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 text-sm font-semibold text-slate-700">Términos relevantes</h4>
                  <div className="space-y-2">
                    {glosarioFiltrado.map((g) => (
                      <div key={g.termino} className="rounded-lg border border-slate-100 px-3 py-2">
                        <p className="text-xs font-semibold text-indigo-700">{g.termino}</p>
                        <p className="text-xs leading-relaxed text-slate-600">{g.definicion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Glosario completo */}
          {tabActual === "glosario" && (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar término…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {glosarioMostrado.length} de {GLOSARIO_COMPLETO.length} términos
                </p>
              </div>

              <div className="space-y-2">
                {glosarioMostrado.map((g) => (
                  <div key={g.termino} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="text-sm font-semibold text-indigo-700">{g.termino}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{g.definicion}</p>
                  </div>
                ))}
                {glosarioMostrado.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">Sin resultados para «{busqueda}».</p>
                )}
              </div>
            </div>
          )}

          {/* Sin manual para esta ruta */}
          {tabActual === "manual" && !manual && (
            <div className="py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="mt-3 text-sm text-slate-500">
                No hay manual específico para esta pantalla.
              </p>
              <p className="text-xs text-slate-400">Consulte el glosario general.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-center text-[10px] text-slate-400">
            Ruta actual: <span className="font-mono">{pathname}</span>
          </p>
        </div>
      </aside>
    </>
  );
}

/**
 * Botón flotante para abrir la ayuda. Integrar en PortalLayout o en cada página.
 */
export function HelpFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      title="Ayuda"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}
