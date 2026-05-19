import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Card from "../components/ui/Card.jsx";
import {
  metaComplementariaBandeja,
  tituloSolicitudBandeja,
} from "../features/solicitudes/bandejaSolicitudesFormat.js";
import {
  callListarSolicitudesBandejaRrhh,
  callResolverDecisionRrhhSolicitud,
} from "../services/callables.js";

export default function BandejaRrhhSolicitudes() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [selId, setSelId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [procesando, setProcesando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await callListarSolicitudesBandejaRrhh({});
      setLista(res?.data?.solicitudes || []);
    } catch (e) {
      setLista([]);
      setError(e?.message || "No se pudo cargar la bandeja RRHH.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const sel = lista.find((s) => s.solicitud_id === selId) || null;

  async function decidir(decision) {
    if (!selId || procesando) return;
    setProcesando(true);
    const t = toast.loading(decision === "aprobar" ? "Aprobando…" : "Rechazando…");
    try {
      await callResolverDecisionRrhhSolicitud({
        solicitud_id: selId,
        decision,
        motivo: motivo.trim() || undefined,
      });
      toast.success(
        decision === "aprobar" ? "Solicitud aprobada (definitiva)." : "Solicitud rechazada.",
        { id: t },
      );
      setSelId("");
      setMotivo("");
      await recargar();
    } catch (e) {
      toast.error(e?.message || "No se pudo completar la acción.", { id: t });
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja — revisión RRHH</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Solicitudes que el jefe derivó a RRHH. Aprobación definitiva o rechazo con devolución de saldo Patrón B.
        </p>
      </header>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-3">
          <span className="text-sm font-semibold text-slate-800">
            Pendientes RRHH
            {!cargando && !error ? (
              <span className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-violet-200 px-1.5 text-xs font-bold text-violet-900">
                {lista.length}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            className="text-sm font-medium text-violet-800 hover:underline disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>

        <div className="p-4">
          {cargando ? <p className="text-sm text-slate-500">Cargando…</p> : null}
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {!cargando && !error && lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay solicitudes pendientes de RRHH.</p>
          ) : null}

          <ul className="max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto">
            {lista.map((s) => {
              const selected = selId === s.solicitud_id;
              return (
                <li key={s.solicitud_id}>
                  <button
                    type="button"
                    onClick={() => setSelId(s.solicitud_id)}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-left transition-all",
                      selected
                        ? "border-violet-400 bg-violet-50/90 shadow-sm ring-1 ring-violet-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <p className="text-[15px] font-semibold leading-snug text-slate-900">
                      {tituloSolicitudBandeja(s)}
                    </p>
                    <p className="mt-1.5 text-sm italic text-slate-500">({metaComplementariaBandeja(s)})</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      {sel ? (
        <Card className="mt-5 space-y-4 border-violet-100 p-4 shadow-sm">
          <div>
            <p className="text-[15px] font-semibold text-slate-900">{tituloSolicitudBandeja(sel)}</p>
            <p className="mt-1.5 text-sm italic text-slate-500">({metaComplementariaBandeja(sel)})</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Motivo (opcional)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              placeholder="Observación para auditoría"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={procesando}
              onClick={() => decidir("aprobar")}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Aprobar (definitivo)
            </button>
            <button
              type="button"
              disabled={procesando}
              onClick={() => decidir("rechazar")}
              className="min-h-11 flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Aprobar deja la solicitud en estado aprobado; el saldo descontado al ingreso se mantiene. Rechazar anula y
            devuelve el saldo Patrón B si correspondía.
          </p>
        </Card>
      ) : lista.length > 0 && !cargando ? (
        <p className="mt-4 text-center text-sm text-slate-500">Seleccioná una solicitud para aprobar o rechazar.</p>
      ) : null}
    </div>
  );
}
