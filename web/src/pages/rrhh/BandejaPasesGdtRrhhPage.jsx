import { useCallback, useEffect, useState } from "react";

import PrimaryButton from "../../components/ui/PrimaryButton.jsx";
import AprobarPaseGdtModal from "../../features/plantel/AprobarPaseGdtModal.jsx";
import {
  callListarPasesGdtPendientesRrhh,
  callRechazarPaseGdt,
} from "../../services/callables.js";

/**
 * Bandeja RRHH — pases externos pendientes (PENDIENTE_RRHH).
 * Ruta: /portal/rrhh/pases-gdt
 */
export default function BandejaPasesGdtRrhhPage() {
  const [items, setItems] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [paseAprobar, setPaseAprobar] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [paseRechazar, setPaseRechazar] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callListarPasesGdtPendientesRrhh({});
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar la bandeja de pases.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 5000);
  };

  const confirmarRechazo = async () => {
    if (!paseRechazar?.pase_id) return;
    if (motivoRechazo.trim().length < 3) {
      setError("Indicá un motivo de rechazo (mín. 3 caracteres).");
      return;
    }
    setRechazando(true);
    setError("");
    try {
      await callRechazarPaseGdt({
        pase_id: paseRechazar.pase_id,
        motivo_rechazo: motivoRechazo.trim(),
      });
      setPaseRechazar(null);
      setMotivoRechazo("");
      showFeedback("Pase rechazado. El HLg no fue modificado.");
      await cargar();
    } catch (e) {
      setError(e?.message || "No se pudo rechazar el pase.");
    } finally {
      setRechazando(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:px-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pases GDT pendientes</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Solicitudes de traslado externo enviadas por jefatura. Aprobar ejecuta el cambio de HLg;
            rechazar solo cierra la solicitud.
          </p>
        </div>
        <PrimaryButton type="button" onClick={cargar} disabled={loading} className="sm:w-auto">
          {loading ? "Actualizando…" : "Actualizar"}
        </PrimaryButton>
      </header>

      {feedback ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Agente</th>
                <th className="px-3 py-2.5 font-semibold">Origen</th>
                <th className="px-3 py-2.5 font-semibold">Destino sugerido</th>
                <th className="px-3 py-2.5 font-semibold">Fecha</th>
                <th className="px-3 py-2.5 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No hay pases pendientes.
                  </td>
                </tr>
              ) : null}
              {items.map((it) => {
                const nombre = [it.agente_apellido, it.agente_nombre].filter(Boolean).join(", ") || it.agente_persona_id;
                return (
                  <tr key={String(it.pase_id)} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{nombre}</p>
                      <p className="text-xs text-slate-500">DNI {it.agente_dni || "—"}</p>
                      {it.motivo ? (
                        <p className="mt-1 max-w-xs text-xs text-slate-500 line-clamp-2">{String(it.motivo)}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {String(it.gdt_origen_nombre || it.gdt_origen_id || "—")}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {String(it.destino_sugerido_texto || "—")}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">
                      {String(it.fecha_efectiva || "—")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                        <button
                          type="button"
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          onClick={() => setPaseAprobar(it)}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setMotivoRechazo("");
                            setPaseRechazar(it);
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AprobarPaseGdtModal
        abierto={Boolean(paseAprobar)}
        pase={/** @type {any} */ (paseAprobar)}
        onCerrar={() => setPaseAprobar(null)}
        onExito={(data) => {
          showFeedback(
            `Pase aprobado. Nuevo HLg desde ${data.fecha_inicio_destino || "el día siguiente"} (${data.pase_id || "ok"}).`,
          );
          cargar();
        }}
      />

      {paseRechazar ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !rechazando) setPaseRechazar(null);
          }}
        >
          <div className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">Rechazar pase</h2>
            <p className="mt-1 text-xs text-slate-500">
              No se modifica el HLg del agente. Indicá el motivo del rechazo.
            </p>
            <textarea
              className="mt-3 min-h-[5rem] w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              value={motivoRechazo}
              onChange={(ev) => setMotivoRechazo(ev.target.value)}
              disabled={rechazando}
              placeholder="Motivo del rechazo…"
              maxLength={500}
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
              <PrimaryButton
                type="button"
                disabled={rechazando || motivoRechazo.trim().length < 3}
                onClick={confirmarRechazo}
                className="sm:w-auto"
              >
                {rechazando ? "Rechazando…" : "Confirmar rechazo"}
              </PrimaryButton>
              <button
                type="button"
                className="min-h-12 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={rechazando}
                onClick={() => setPaseRechazar(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
