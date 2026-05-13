import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase.js";
import ArticuloConfigTabs from "../features/configuracion/articulos/ArticuloConfigTabs.jsx";

export default function ArticuloConfiguracion() {
  const navigate = useNavigate();
  const { articuloId } = useParams();
  const [articuloNombre, setArticuloNombre] = useState("");
  const [coreData, setCoreData] = useState(null);
  const [reactivando, setReactivando] = useState(false);

  const esNuevo = articuloId === "nuevo";
  const artIdValido = !esNuevo && /^art_[0-9A-HJKMNP-TV-Z]{26}$/.test(articuloId ?? "");

  useEffect(() => {
    if (!artIdValido) return;
    let cancelled = false;
    async function fetchCore() {
      try {
        const snap = await getDoc(doc(db, "cfg_articulos", articuloId));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setArticuloNombre(d.nombre || d.codigo || "");
          setCoreData(d);
        }
      } catch {
        /* silencioso: el nombre es solo cosmético */
      }
    }
    fetchCore();
    return () => { cancelled = true; };
  }, [articuloId, artIdValido]);

  const reactivar = useCallback(async () => {
    if (!artIdValido) return;
    const t = toast.loading("Reactivando artículo…");
    setReactivando(true);
    try {
      await setDoc(
        doc(db, "cfg_articulos", articuloId),
        { activo: true, motivo_deshabilitado: null, fecha_deshabilitado: null },
        { merge: true },
      );
      setCoreData((prev) => (prev ? { ...prev, activo: true, motivo_deshabilitado: null, fecha_deshabilitado: null } : prev));
      toast.success("Artículo reactivado.", { id: t });
    } catch (err) {
      toast.error(err?.message || "Error al reactivar.", { id: t });
    } finally {
      setReactivando(false);
    }
  }, [articuloId, artIdValido]);

  const titulo = esNuevo
    ? "Nuevo artículo"
    : articuloNombre || "Artículos — configuración";

  const inactivo = coreData?.activo === false;

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      {inactivo && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-5 shadow-sm md:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-6 w-6 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-base font-semibold text-red-800">Artículo deshabilitado</p>
                <p className="mt-0.5 text-sm text-red-700">
                  No disponible para nuevas solicitudes.
                  {coreData.motivo_deshabilitado && (
                    <> Motivo: <span className="font-medium">{coreData.motivo_deshabilitado}</span>.</>
                  )}
                </p>
                {coreData.fecha_deshabilitado && (
                  <p className="mt-0.5 text-xs text-red-600">
                    Deshabilitado el{" "}
                    {typeof coreData.fecha_deshabilitado?.toDate === "function"
                      ? coreData.fecha_deshabilitado.toDate().toLocaleDateString("es-AR")
                      : String(coreData.fecha_deshabilitado)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={reactivar}
              disabled={reactivando}
              className="shrink-0 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-[0.97] disabled:opacity-50 md:hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              {reactivando ? "Reactivando…" : "Reactivar artículo"}
            </button>
          </div>
        </div>
      )}

      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/portal/rrhh/configuracion-articulos")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            aria-label="Volver al listado"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              {titulo}
            </h1>
            {artIdValido && (
              <p className="mt-0.5 text-xs text-slate-500">
                (<span className="italic font-mono">{articuloId}</span>)
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
          Configurá los parámetros del artículo y sus versiones.
          {esNuevo && " Completá los datos y guardá para crear el artículo."}
        </p>
      </header>

      <ArticuloConfigTabs />
    </div>
  );
}
