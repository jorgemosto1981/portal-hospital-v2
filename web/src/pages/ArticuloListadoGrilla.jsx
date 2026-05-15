import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../config/firebase.js";
import { useCatalogosArticulos } from "../hooks/useCatalogosArticulos.js";
import { listarColeccion } from "../services/configuracionCatalogosService.js";
import { loadVersionesSubcoleccion } from "../services/articuloVersionesListService.js";

function estadoVersionLabel(estadoVersionId, getOptions) {
  const id = String(estadoVersionId || "").trim();
  if (!id) return "—";
  const opts = getOptions("cfg_estado_version_articulo");
  const hit = opts.find((o) => o.value === id);
  return hit?.label || id;
}

function BadgeEstado({ activo }) {
  if (activo === false) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Activo
    </span>
  );
}

function DeshabilitarArticuloModal({ articulo, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [saving, setSaving] = useState(false);

  const codigoCoincide =
    codigoInput.trim().toLowerCase() === (articulo.codigo ?? "").trim().toLowerCase();
  const puedeConfirmar = motivo.trim().length > 0 && codigoCoincide && acepta && !saving;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "cfg_articulos", articulo.id),
        { activo: false, motivo_deshabilitado: motivo.trim(), fecha_deshabilitado: serverTimestamp() },
        { merge: true },
      );
      toast.success(`Artículo ${articulo.codigo} deshabilitado.`);
      onConfirm();
    } catch (err) {
      toast.error(err?.message || "Error al deshabilitar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900">Deshabilitar artículo</h3>
        <p className="text-sm text-slate-600">
          ¿Estás seguro de deshabilitar{" "}
          <span className="font-semibold">{articulo.codigo} — {articulo.nombre || "Sin nombre"}</span>?
          Esta acción impedirá que los agentes inicien nuevas solicitudes. Las solicitudes ya enviadas no se verán afectadas.
        </p>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Motivo de deshabilitación</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
            placeholder="Ej: Reemplazado por Art. 41 según Resolución 123/2026"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">
            Escribí el código del artículo (<span className="font-mono font-semibold">{articulo.codigo}</span>) para confirmar
          </span>
          <input
            type="text"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-100 focus:ring-2"
            placeholder={articulo.codigo}
          />
          {codigoInput.trim() && !codigoCoincide && (
            <span className="text-[11px] text-red-600">El código no coincide.</span>
          )}
        </label>

        <label className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600"
          />
          <span className="text-sm text-slate-800">Entiendo las consecuencias de esta acción.</span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-transform active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!puedeConfirmar}
            onClick={handleConfirm}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Deshabilitando…" : "Deshabilitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionesVisualesStrip({ versiones, versionActualId, articuloId, getOptions, catalogosLoading }) {
  const navigate = useNavigate();
  if (versiones.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Sin versiones en la subcolección <span className="font-mono">versiones</span>.
      </p>
    );
  }
  return (
    <div className="max-w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
      <div className="flex w-max max-w-none flex-nowrap gap-2.5 pr-1 md:flex-wrap md:pr-0">
        {versiones.map((ver) => {
        const esActual = versionActualId === ver.versionId;
        const verCorta = `…${ver.versionId.slice(-8)}`;
        return (
          <div
            key={ver.versionId}
            className={`relative flex min-w-[9rem] max-w-[12rem] flex-col gap-1.5 rounded-2xl border p-3 shadow-sm ${
              esActual
                ? "border-blue-300 bg-gradient-to-br from-blue-50/90 to-white ring-2 ring-blue-400/80"
                : "border-slate-200/80 bg-gradient-to-br from-white to-slate-50"
            }`}
          >
            {esActual ? (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                Actual
              </span>
            ) : null}
            <div className="pr-6">
              {ver.correspondenciaAnio != null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums leading-none text-slate-900">
                    {ver.correspondenciaAnio}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">fiscal</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-slate-400">Sin año fiscal</span>
              )}
            </div>
            <p className="font-mono text-[10px] text-slate-500" title={ver.versionId}>
              {verCorta}
            </p>
            <p className="line-clamp-2 min-h-[2rem] text-[11px] leading-snug text-slate-600" title={ver.versionSemantica}>
              {ver.versionSemantica}
            </p>
            <p className="text-[10px] text-slate-500">
              <span className="font-medium text-slate-600">Estado:</span>{" "}
              {catalogosLoading ? "…" : estadoVersionLabel(ver.estadoVersionId, getOptions)}
            </p>
            {ver.publicadaEn ? (
              <p className="text-[10px] text-slate-400">
                <span className="font-medium text-slate-500">Publicada:</span> {ver.publicadaEn}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/portal/rrhh/configuracion-articulos/${articuloId}?versionId=${encodeURIComponent(ver.versionId)}`,
                )
              }
              className="mt-0.5 inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Abrir en configurador
            </button>
          </div>
        );
        })}
      </div>
    </div>
  );
}

export default function ArticuloListadoGrilla() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getOptions, loading: catalogosLoading } = useCatalogosArticulos(["cfg_estado_version_articulo"]);
  const [articulos, setArticulos] = useState([]);
  const [versionesPorArticulo, setVersionesPorArticulo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deshabilitarTarget, setDeshabilitarTarget] = useState(null);

  const fetchArticulos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listarColeccion("cfg_articulos");
      const sorted = [...items].sort((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? ""));
      setArticulos(sorted);

      const settled = await Promise.allSettled(sorted.map((a) => loadVersionesSubcoleccion(a.id)));
      const map = {};
      sorted.forEach((a, i) => {
        if (!a?.id) return;
        const r = settled[i];
        map[a.id] = r.status === "fulfilled" ? r.value : [];
      });
      setVersionesPorArticulo(map);
    } catch (err) {
      setError(err.message ?? "Error al leer cfg_articulos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArticulos();
  }, [fetchArticulos, location.key]);

  const handleReactivar = async (art) => {
    const t = toast.loading("Reactivando…");
    try {
      await setDoc(
        doc(db, "cfg_articulos", art.id),
        { activo: true, motivo_deshabilitado: null, fecha_deshabilitado: null },
        { merge: true },
      );
      toast.success(`Artículo ${art.codigo} reactivado.`, { id: t });
      fetchArticulos();
    } catch (err) {
      toast.error(err?.message || "Error al reactivar.", { id: t });
    }
  };

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Artículos — listado
            </h1>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
              Artículos ordenados por código. En cada tarjeta ves todas las versiones guardadas en Firestore; la que coincide
              con <span className="font-mono text-xs">version_actual_id</span> lleva el distintivo <strong>Actual</strong>.
              Tras clonar o guardar una versión nueva, pulsá <strong>Refrescar listado</strong> o volvé a entrar en esta pantalla.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchArticulos()}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refrescar listado
            </button>
            <button
              type="button"
              onClick={() => navigate("/portal/rrhh/configuracion-articulos/nuevo")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1Z" />
              </svg>
              Nuevo artículo
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-slate-400">Cargando artículos y versiones…</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && articulos.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No hay artículos configurados en <span className="font-mono">cfg_articulos</span>.
        </div>
      )}

      {!loading && !error && articulos.length > 0 && (
        <div className="space-y-4">
          {articulos.map((art) => {
            const inactivo = art.activo === false;
            const idCorto = art.id ? `…${art.id.slice(-8)}` : "";
            const versiones = versionesPorArticulo[art.id] ?? [];
            return (
              <article
                key={art.id}
                className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${inactivo ? "opacity-65" : ""}`}
              >
                <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between md:gap-6 md:p-5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg font-bold text-slate-900">{art.codigo || "—"}</span>
                      {art.inciso_normativo && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                          {art.inciso_normativo}
                        </span>
                      )}
                      <BadgeEstado activo={art.activo} />
                    </div>
                    <h2 className="text-base font-semibold text-slate-800">
                      {art.nombre || <span className="italic font-normal text-slate-400">Sin nombre</span>}
                    </h2>
                    <p className="font-mono text-[11px] text-slate-400" title={art.id}>
                      {idCorto}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/portal/rrhh/configuracion-articulos/${art.id}` +
                            (art.version_actual_id ? `?versionId=${art.version_actual_id}` : ""),
                        )
                      }
                      className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                    >
                      Gestionar
                    </button>
                    {inactivo ? (
                      <button
                        type="button"
                        onClick={() => handleReactivar(art)}
                        className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                      >
                        Reactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeshabilitarTarget(art)}
                        className="inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                      >
                        Deshabilitar
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 md:px-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Versiones del artículo
                    </p>
                    <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">
                      {versiones.length} en Firestore
                    </span>
                  </div>
                  <VersionesVisualesStrip
                    versiones={versiones}
                    versionActualId={art.version_actual_id}
                    articuloId={art.id}
                    getOptions={getOptions}
                    catalogosLoading={catalogosLoading}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {deshabilitarTarget && (
        <DeshabilitarArticuloModal
          articulo={deshabilitarTarget}
          onClose={() => setDeshabilitarTarget(null)}
          onConfirm={() => {
            setDeshabilitarTarget(null);
            fetchArticulos();
          }}
        />
      )}
    </div>
  );
}
