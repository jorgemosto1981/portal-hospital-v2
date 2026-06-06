import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  capaContextoParaFlujoC,
  diaMaterializadoParaGestion,
  mensajeErrorCapaTeorico,
  resumenTeoricoParaModal,
} from "./grillaCeldaTeorico.js";
import { regimenPermiteIntercambioGuardia } from "./grillaCoberturaParcialPreview.js";
import { turnosDisponiblesDesdeRegimen } from "./enrichCapaTeoricaLabels.js";
import { leerCapaTeoricaCelda } from "../../services/grillaMaterializarCeldaService.js";
import { callListarContextoPlanGrupo } from "../../services/callables.js";
import GestionTurnoWizardPaso1 from "./GestionTurnoWizardPaso1.jsx";

/**
 * Shell F-UX.3 — gate materialización + wizard paso 1 (A/B/C).
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   personaId: string;
 *   fechaYmd: string;
 *   grupoTrabajoId: string;
 *   personaLabel?: string;
 *   grupoLabel?: string;
 *   hlgId?: string;
 *   turnoVisInicial?: Record<string, unknown> | null;
 *   onCapaActualizada?: () => void;
 *   onAbrirAyuda?: () => void;
 *   onElegirFlujo?: (flujo: import("./gestionTurnoWizardOpciones.js").GestionTurnoFlujoId) => void;
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
  hlgId,
  turnoVisInicial,
  onAbrirAyuda,
  onElegirFlujo,
}) {
  const [capaResp, setCapaResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnosPorId, setTurnosPorId] = useState(/** @type {Record<string, object>} */ ({}));
  const [regimenHorarioId, setRegimenHorarioId] = useState("");
  const [regimenesIdx, setRegimenesIdx] = useState(/** @type {Record<string, object>} */ ({}));
  const [flujoSeleccionado, setFlujoSeleccionado] = useState(/** @type {string | null} */ (null));

  const bloqueoIntercambio = useMemo(() => {
    if (!regimenHorarioId) return null;
    const r = regimenPermiteIntercambioGuardia(regimenHorarioId, regimenesIdx);
    return r.ok ? null : r.error;
  }, [regimenHorarioId, regimenesIdx]);

  const opcionesBloqueadas = useMemo(
    () => (bloqueoIntercambio ? { cobertura_parcial: bloqueoIntercambio } : {}),
    [bloqueoIntercambio],
  );

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
      setFlujoSeleccionado(null);
      return;
    }
    void recargar();
  }, [open, recargar]);

  const materializado = diaMaterializadoParaGestion(capaResp);
  const capa = capaResp?.capa_teorica ?? capaResp?.capa_teorica_grupo ?? null;
  const resumen = resumenTeoricoParaModal({
    capa: capaContextoParaFlujoC(capa, capaResp?.vis_dia, turnoVisInicial),
    visDia: capaResp?.vis_dia,
    turnoVis: turnoVisInicial,
    turnosPorId,
  });

  const opcionesBloqueadasFlujo = opcionesBloqueadas;

  const listoWizard = !loading && capaResp != null && !error;
  const soloFlujoC = listoWizard && !materializado;
  const flujosPermitidos = soloFlujoC ? /** @type {const} */ (["adicional"]) : null;

  useEffect(() => {
    if (!open || !soloFlujoC) return;
    setFlujoSeleccionado("adicional");
  }, [open, soloFlujoC]);

  useEffect(() => {
    if (!open || !grupoTrabajoId || !fechaYmd) return;
    const periodo = fechaYmd.slice(0, 7);
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await callListarContextoPlanGrupo({ grupo_id: grupoTrabajoId, periodo });
        const regimenes = ctx?.data?.regimenes || {};
        const personasGrupo = ctx?.data?.personas_grupo || [];
        const hlgIdNorm = String(hlgId || "").trim();
        const hlg = hlgIdNorm
          ? personasGrupo.find((p) => String(p.hlg_id || "").trim() === hlgIdNorm)
          : personasGrupo.find((p) => p.persona_id === personaId);
        if (!cancelled) {
          setRegimenesIdx(regimenes);
          const regId = String(hlg?.regimen_horario_id || "").trim();
          setRegimenHorarioId(regId);
          setTurnosPorId(regId ? turnosDisponiblesDesdeRegimen(regimenes, regId) : {});
        }
      } catch {
        if (!cancelled) {
          setTurnosPorId({});
          setRegimenHorarioId("");
          setRegimenesIdx({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, grupoTrabajoId, fechaYmd, personaId, hlgId]);

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

        {listoWizard ? (
          <GestionTurnoWizardPaso1
            seleccion={flujoSeleccionado}
            onSeleccion={setFlujoSeleccionado}
            opcionesBloqueadas={opcionesBloqueadasFlujo}
            flujosPermitidos={flujosPermitidos}
            onAbrirAyuda={onAbrirAyuda}
            onCancelar={onClose}
            onContinuar={() => {
              if (!flujoSeleccionado) return;
              if (onElegirFlujo) {
                onElegirFlujo(/** @type {import("./gestionTurnoWizardOpciones.js").GestionTurnoFlujoId} */ (flujoSeleccionado));
              } else {
                toast("Flujo seleccionado. Conectá onElegirFlujo en el panel.", { icon: "ℹ️" });
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
