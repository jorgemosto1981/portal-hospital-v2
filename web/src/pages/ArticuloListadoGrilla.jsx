import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "../config/firebase.js";
import { listarColeccion } from "../services/configuracionCatalogosService.js";

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

export default function ArticuloListadoGrilla() {
  const navigate = useNavigate();
  const [articulos, setArticulos] = useState([]);
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
    } catch (err) {
      setError(err.message ?? "Error al leer cfg_articulos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticulos(); }, [fetchArticulos]);

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
              Seleccioná un artículo para abrir su configurador técnico.
            </p>
          </div>
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
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-slate-400">Cargando artículos…</span>
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
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="hidden px-4 py-3 sm:table-cell">Versión actual</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articulos.map((art) => {
                const inactivo = art.activo === false;
                return (
                  <tr key={art.id} className={`transition-colors active:bg-slate-50 ${inactivo ? "opacity-60" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-700">
                      {art.codigo || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEstado activo={art.activo} />
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      {art.nombre || <span className="italic text-slate-400">Sin nombre</span>}
                      {" "}
                      <span className="italic text-slate-400">({art.id})</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 sm:table-cell">
                      {art.version_actual_id || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/portal/rrhh/configuracion-articulos/${art.id}` +
                              (art.version_actual_id ? `?versionId=${art.version_actual_id}` : "")
                            )
                          }
                          className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                        >
                          Gestionar
                        </button>
                        {inactivo ? (
                          <button
                            type="button"
                            onClick={() => handleReactivar(art)}
                            className="inline-flex min-h-11 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeshabilitarTarget(art)}
                            className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                          >
                            Deshabilitar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
