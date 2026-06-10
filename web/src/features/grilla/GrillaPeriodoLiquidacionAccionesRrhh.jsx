import { useState } from "react";
import toast from "react-hot-toast";

import {
  callCerrarPeriodoLiquidacion,
  callReabrirPeriodoLiquidacion,
} from "../../services/callables.js";
import { RX_GDT } from "./grillaGrupoUtils.js";

/**
 * Cerrar / reabrir liquidación del sector seleccionado (RRHH).
 * @param {{
 *   grupoId: string;
 *   anio: number;
 *   mes: number;
 *   periodoLabel: string;
 *   grupoLabel?: string;
 *   cerrado: boolean;
 *   onCompletado: () => void | Promise<void>;
 *   compact?: boolean;
 * }} props
 */
export default function GrillaPeriodoLiquidacionAccionesRrhh({
  grupoId,
  anio,
  mes,
  periodoLabel,
  grupoLabel = "",
  cerrado,
  onCompletado,
  compact = false,
}) {
  const [operando, setOperando] = useState(false);
  const [mostrarReabrir, setMostrarReabrir] = useState(false);
  const [motivoReabrir, setMotivoReabrir] = useState("");
  const [modalCerrar, setModalCerrar] = useState(false);
  const [checkCierre, setCheckCierre] = useState(false);

  const gdtOk = RX_GDT.test(String(grupoId || "").trim());
  const sectorTxt = grupoLabel || grupoId || "sector";

  const cerrarModalCierre = () => {
    setModalCerrar(false);
    setCheckCierre(false);
  };

  const handleCerrarConfirmado = async () => {
    if (!gdtOk || operando || cerrado || !checkCierre) return;
    setOperando(true);
    try {
      const res = await callCerrarPeriodoLiquidacion({
        grupo_trabajo_id: grupoId,
        anio,
        mes,
        motivo: "cierre_manual_rrhh_gso",
      });
      const n = res?.data?.actualizados ?? 0;
      toast.success(`Período cerrado (${n} vista(s) actualizadas).`);
      cerrarModalCierre();
      await onCompletado();
    } catch (e) {
      toast.error(e?.message || "No se pudo cerrar el período.");
    } finally {
      setOperando(false);
    }
  };

  const handleReabrir = async () => {
    if (!gdtOk || operando || !cerrado) return;
    const motivo = motivoReabrir.trim();
    if (motivo.length < 3) {
      toast.error("Indicá un motivo de reapertura (mín. 3 caracteres).");
      return;
    }
    setOperando(true);
    try {
      const res = await callReabrirPeriodoLiquidacion({
        grupo_trabajo_id: grupoId,
        anio,
        mes,
        motivo,
      });
      const n = res?.data?.actualizados ?? 0;
      toast.success(`Período reabierto (${n} vista(s) actualizadas).`);
      setMostrarReabrir(false);
      setMotivoReabrir("");
      await onCompletado();
    } catch (e) {
      toast.error(e?.message || "No se pudo reabrir el período.");
    } finally {
      setOperando(false);
    }
  };

  if (!gdtOk) {
    if (compact) return null;
    return (
      <p className="text-xs text-slate-600">
        Abrí una tarjeta de grupo para cerrar o reabrir liquidación.
      </p>
    );
  }

  const btnCerrar =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-rose-700 disabled:opacity-50";
  const btnReabrir =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-violet-800 disabled:opacity-50";

  return (
    <div className={compact ? "space-y-1.5" : "mt-1 space-y-2"}>
      {cerrado && !compact ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Período cerrado</span> — {periodoLabel} · {sectorTxt}. Podés
          consultar la grilla; para altas o cambios, reabrí el período.
        </p>
      ) : null}
      {cerrado && compact ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Período cerrado</span> — {periodoLabel} · {sectorTxt}.
        </p>
      ) : null}

      <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"}>
        {!cerrado ? (
          <button
            type="button"
            disabled={operando}
            onClick={() => setModalCerrar(true)}
            className={btnCerrar}
          >
            {operando ? "Procesando…" : "Cerrar período de liquidación"}
          </button>
        ) : (
          <button
            type="button"
            disabled={operando}
            onClick={() => setMostrarReabrir((v) => !v)}
            className={btnReabrir}
          >
            {operando ? "Procesando…" : "Reabrir período de liquidación"}
          </button>
        )}
      </div>

      {modalCerrar ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cierre-titulo"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 id="modal-cierre-titulo" className="text-base font-semibold text-slate-900">
              ¿Confirmar cierre de liquidación?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {periodoLabel} · {sectorTxt}. El mes quedará en solo lectura para solicitudes y cambios
              de turno de jefatura.
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <input
                type="checkbox"
                checked={checkCierre}
                onChange={(e) => setCheckCierre(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Entiendo que, una vez cerrado, hará falta una reapertura manual por RRHH para volver a
                editar.
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={operando}
                onClick={cerrarModalCierre}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={operando || !checkCierre}
                onClick={() => void handleCerrarConfirmado()}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white disabled:bg-slate-300 disabled:text-slate-500"
              >
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cerrado && mostrarReabrir ? (
        <div
          className={`border border-slate-200 bg-slate-50 ${compact ? "rounded-lg p-2" : "rounded-xl p-3"}`}
        >
          <label className="block text-xs font-medium text-slate-700">
            Motivo de reapertura (obligatorio)
            <textarea
              value={motivoReabrir}
              onChange={(e) => setMotivoReabrir(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej.: corrección de licencia omitida en liquidación"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={operando || motivoReabrir.trim().length < 3}
              onClick={() => void handleReabrir()}
              className="min-h-9 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirmar reapertura
            </button>
            <button
              type="button"
              disabled={operando}
              onClick={() => {
                setMostrarReabrir(false);
                setMotivoReabrir("");
              }}
              className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
