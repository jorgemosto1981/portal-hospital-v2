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

  const gdtOk = RX_GDT.test(String(grupoId || "").trim());
  const sectorTxt = grupoLabel || grupoId || "sector";

  const handleCerrar = async () => {
    if (!gdtOk || operando || cerrado) return;
    const ok = window.confirm(
      `¿Cerrar liquidación de ${periodoLabel} para ${sectorTxt}? El mes quedará en solo lectura para nuevas solicitudes y cambios de turno.`,
    );
    if (!ok) return;
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

  const btnBase = compact
    ? "min-h-9 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-60"
    : "min-h-11 rounded-xl px-3 text-sm font-semibold disabled:opacity-60";

  return (
    <div className={compact ? "space-y-1.5" : "mt-3 space-y-2"}>
      {cerrado && !compact ? (
        <p className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Período cerrado</span> — {periodoLabel} · {sectorTxt}. Podés
          consultar la grilla; para altas o cambios, reabrí el período.
        </p>
      ) : null}
      {cerrado && compact ? (
        <p className="text-[11px] text-slate-600">
          Período cerrado · {periodoLabel} · {sectorTxt}
        </p>
      ) : null}

      <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-2 sm:flex-row"}>
        {!cerrado ? (
          <button
            type="button"
            disabled={operando}
            onClick={() => void handleCerrar()}
            className={`${btnBase} border border-amber-400 bg-amber-50 text-amber-950 active:bg-amber-100 ${compact ? "" : "flex-1"}`}
          >
            {operando ? "Procesando…" : compact ? "Cerrar período" : "Cerrar período de liquidación"}
          </button>
        ) : (
          <button
            type="button"
            disabled={operando}
            onClick={() => setMostrarReabrir((v) => !v)}
            className={`${btnBase} border border-violet-400 bg-violet-50 text-violet-950 active:bg-violet-100 ${compact ? "" : "flex-1"}`}
          >
            {operando ? "Procesando…" : compact ? "Reabrir período" : "Reabrir período de liquidación"}
          </button>
        )}
      </div>

      {cerrado && mostrarReabrir ? (
        <div
          className={`border border-violet-200 bg-white ${compact ? "rounded-lg p-2" : "rounded-xl p-3"}`}
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
              className={`${compact ? "min-h-9 text-xs" : "min-h-11 text-sm"} rounded-lg bg-violet-700 px-3 font-semibold text-white disabled:opacity-50`}
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
              className={`${compact ? "min-h-9 text-xs" : "min-h-11 text-sm"} rounded-lg border border-slate-300 px-3 text-slate-700`}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
