import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import {
  diaMaterializadoParaGestion,
  mensajeErrorCapaTeorico,
  resumenTeoricoCorta,
} from "./grillaCeldaTeorico.js";
import { materializarCeldaDia, leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";

/**
 * Shell F-UX.3 — gate materialización + cabecera. Wizard A/B/C en entregable 2.
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   personaId: string;
 *   fechaYmd: string;
 *   grupoTrabajoId: string;
 *   personaLabel?: string;
 *   grupoLabel?: string;
 *   turnoVisInicial?: Record<string, unknown> | null;
 *   onCapaActualizada?: () => void;
 * }} props
 */
export default function GestionTurnoDiaShell({
  open,
  onClose,
  personaId,
  fechaYmd,
  grupoTrabajoId,
  personaLabel,
  grupoLabel,
  turnoVisInicial,
  onCapaActualizada,
}) {
  const [capaResp, setCapaResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [materializando, setMaterializando] = useState(false);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    if (!personaId || !fechaYmd || !grupoTrabajoId) return;
    setLoading(true);
    setError("");
    try {
      const data = await leerCapaTeoricaCelda(personaId, fechaYmd, grupoTrabajoId);
      setCapaResp(data);
    } catch (e) {
      setCapaResp(null);
      setError(mensajeErrorCapaTeorico(e));
    } finally {
      setLoading(false);
    }
  }, [personaId, fechaYmd, grupoTrabajoId]);

  useEffect(() => {
    if (!open) {
      setCapaResp(null);
      setError("");
      return;
    }
    void recargar();
  }, [open, recargar]);

  const materializado = diaMaterializadoParaGestion(capaResp);
  const capa = capaResp?.capa_teorica ?? capaResp?.capa_teorica_grupo ?? null;
  const resumen = materializado ? resumenTeoricoCorta(capa) : resumenTeoricoCorta(turnoVisInicial?.capa_teorica);

  const onMaterializar = async () => {
    setMaterializando(true);
    setError("");
    try {
      await materializarCeldaDia(personaId, fechaYmd, grupoTrabajoId);
      toast.success("Turno del día calculado.");
      await recargar();
      onCapaActualizada?.();
    } catch (e) {
      const msg = mensajeErrorCapaTeorico(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setMaterializando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gestion-turno-titulo"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div className="relative z-10 max-h-[min(92vh,36rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="gestion-turno-titulo" className="text-xl font-semibold text-slate-900">
              Gestionar turno de este día
            </h3>
            {personaLabel ? (
              <p className="mt-0.5 text-base text-slate-700">{personaLabel}</p>
            ) : null}
            <p className="text-sm text-slate-600">
              {fechaYmd}
              {grupoLabel ? ` · ${grupoLabel}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-3 text-sm text-slate-600 active:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span className="font-medium">Teórico: </span>
          {loading ? "Cargando…" : resumen || "—"}
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        ) : null}

        {!materializado && !loading ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-950">
              Este día aún no tiene turno calculado para este cargo. Calculá el día antes de registrar cambios.
            </p>
            <button
              type="button"
              disabled={materializando}
              onClick={() => void onMaterializar()}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-700 text-base font-semibold text-white active:bg-violet-800 disabled:opacity-60"
            >
              {materializando ? "Calculando…" : "Calcular turno de este día"}
            </button>
          </div>
        ) : null}

        {materializado && !loading ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Siguiente paso (entregable 2): elegir Intercambio de guardia, Cambio de turno propio u Horas adicionales.
          </p>
        ) : null}
      </div>
    </div>
  );
}
