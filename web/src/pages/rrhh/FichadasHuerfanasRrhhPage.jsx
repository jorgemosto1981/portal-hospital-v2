import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import Card from "../../components/ui/Card.jsx";
import ModalMotivoAuditoria from "../../features/fichadas/ModalMotivoAuditoria.jsx";
import { useRelojBiometricoCatalogo } from "../../features/fichadas/useRelojBiometricoCatalogo.js";
import {
  callDescartarMarcaHuerfanaReloj,
  callListarMarcasHuerfanasReloj,
} from "../../services/callables.js";

export default function FichadasHuerfanasRrhhPage() {
  const { relojes, loading: loadingCat } = useRelojBiometricoCatalogo();
  const [relojId, setRelojId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [descarteTarget, setDescarteTarget] = useState(null);
  const [descartando, setDescartando] = useState(false);

  const cargar = useCallback(async () => {
    if (!relojId) return;
    setLoading(true);
    try {
      const res = await callListarMarcasHuerfanasReloj({
        reloj_id: relojId,
        fecha_ymd_desde: fechaDesde || undefined,
        fecha_ymd_hasta: fechaHasta || undefined,
        limite: 300,
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.message || "Error al cargar bandeja.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [relojId, fechaDesde, fechaHasta]);

  useEffect(() => {
    if (relojId) cargar();
  }, [relojId, cargar]);

  const confirmarDescarte = async (motivo) => {
    if (!descarteTarget) return;
    setDescartando(true);
    try {
      await callDescartarMarcaHuerfanaReloj({ fmh_id: descarteTarget.id, motivo });
      toast.success("Marca descartada.");
      setDescarteTarget(null);
      await cargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo descartar.");
    } finally {
      setDescartando(false);
    }
  };

  const linkEnrolar = (row) => {
    const q = new URLSearchParams({
      reloj_id: row.reloj_id || relojId,
      numero_tarjeta: row.numero_tarjeta || "",
    });
    return `/portal/rrhh/fichadas-enrolamiento?${q.toString()}`;
  };

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 px-3 py-5 pb-24 md:px-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">Marcas huérfanas</h1>
        <p className="text-sm text-slate-500">
          Pendientes de enrolamiento ·{" "}
          <Link to="/portal/rrhh/fichadas-import" className="text-blue-600 hover:underline">
            Import TXT
          </Link>
        </p>
      </header>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Reloj
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={relojId}
            onChange={(e) => setRelojId(e.target.value)}
            disabled={loadingCat}
          >
            <option value="">— Seleccionar —</option>
            {relojes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre || r.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Desde (YYYY-MM-DD)
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-700">
          Hasta
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white sm:col-span-2 sm:max-w-xs disabled:opacity-50"
          onClick={cargar}
          disabled={!relojId || loading}
        >
          {loading ? "Cargando…" : "Actualizar bandeja"}
        </button>
      </Card>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Cargando marcas…</p>
        ) : !relojId ? (
          <p className="p-4 text-sm text-slate-500">Elegí un reloj para consultar.</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No hay marcas pendientes en el rango.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2">Tarjeta</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2">Disp.</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-mono">{row.numero_tarjeta}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.fecha_ymd}</td>
                  <td className="px-3 py-2">{row.hora_hm}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.codigo_dispositivo ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-50"
                        onClick={() => setDescarteTarget(row)}
                      >
                        Descartar
                      </button>
                      <Link
                        to={linkEnrolar(row)}
                        className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50"
                      >
                        Enrolar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ModalMotivoAuditoria
        abierto={!!descarteTarget}
        titulo="Descartar marca huérfana"
        onCerrar={() => setDescarteTarget(null)}
        onConfirmar={confirmarDescarte}
        busy={descartando}
      />
    </div>
  );
}
