import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { callSolicitarReconciliacionGrillaGrupoMes } from "../../services/callables.js";
import { RX_GDT } from "./grillaGrupoUtils.js";
import GrillaBadgeSincronizacion from "./GrillaBadgeSincronizacion.jsx";
import { useGrillaSyncState } from "./useGrillaSyncState.js";

function parsePeriodo(periodo) {
  const [yyyy, mm] = String(periodo || "").split("-");
  const anio = Number(yyyy);
  const mes = Number(mm);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { anio, mes };
}

/**
 * @param {{
 *   grupoTrabajoId?: string;
 *   periodoYm?: string;
 *   enabled?: boolean;
 *   syncEstadoListado?: { reconciliacion?: string; ultima_sync_max?: string | null } | null;
 *   onCargarVista?: (opts: { bypassCache: boolean; background: boolean }) => void | Promise<void>;
 * }} opts
 */
export function useGrillaSyncSectorBar({
  grupoTrabajoId = "",
  periodoYm = "",
  enabled = false,
  syncEstadoListado = null,
  onCargarVista,
}) {
  const grillaSync = useGrillaSyncState({
    grupoTrabajoId,
    periodoYm,
    enabled,
  });

  const listadoReconciliacionPendiente = syncEstadoListado?.reconciliacion === "pendiente";

  const estadoSyncAnteriorRef = useRef("");
  useEffect(() => {
    if (!enabled) {
      estadoSyncAnteriorRef.current = "";
      return;
    }
    const prev = estadoSyncAnteriorRef.current;
    const cur = grillaSync.estado;
    if (prev === "en_curso" && cur === "idle") {
      void onCargarVista?.({ bypassCache: true, background: true });
    }
    estadoSyncAnteriorRef.current = cur;
  }, [grillaSync.estado, enabled, onCargarVista]);

  const [solicitando, setSolicitando] = useState(false);

  const sincronizarSector = useCallback(async () => {
    const p = parsePeriodo(periodoYm);
    const gdt = String(grupoTrabajoId || "").trim();
    if (!p || !RX_GDT.test(gdt)) return;
    setSolicitando(true);
    try {
      await callSolicitarReconciliacionGrillaGrupoMes({
        grupo_trabajo_id: gdt,
        anio: p.anio,
        mes: p.mes,
      });
      toast.success("Sincronización del sector en curso.");
    } catch (e) {
      toast.error(e?.message || "No se pudo solicitar la sincronización del sector.");
    } finally {
      setSolicitando(false);
    }
  }, [periodoYm, grupoTrabajoId]);

  return {
    grillaSync,
    listadoReconciliacionPendiente,
    solicitando,
    sincronizarSector,
  };
}

/**
 * @param {{
 *   visible?: boolean;
 *   grillaSync: ReturnType<typeof useGrillaSyncState>;
 *   syncEstadoListado?: { ultima_sync_max?: string | null } | null;
 *   listadoReconciliacionPendiente?: boolean;
 *   puedeSolicitarSync?: boolean;
 *   procesandoGrilla?: boolean;
 *   solicitando?: boolean;
 *   sincronizarSector?: () => void | Promise<void>;
 *   className?: string;
 * }} props
 */
export function GrillaSyncSectorControls({
  visible = true,
  grillaSync,
  syncEstadoListado = null,
  listadoReconciliacionPendiente = false,
  puedeSolicitarSync = false,
  procesandoGrilla = false,
  solicitando = false,
  sincronizarSector,
  className = "",
}) {
  if (!visible) return null;

  return (
    <div className={["flex flex-wrap items-center gap-x-3 gap-y-1", className].filter(Boolean).join(" ")}>
      <GrillaBadgeSincronizacion
        estado={grillaSync.estado}
        sincronizando={grillaSync.sincronizando}
        ultimoOkAt={grillaSync.ultimoOkAt}
        ultimaSyncListado={syncEstadoListado?.ultima_sync_max ?? null}
        errorMensaje={grillaSync.errorMensaje}
        listenerError={grillaSync.listenerError}
        listadoPendiente={listadoReconciliacionPendiente && !grillaSync.existe}
      />
      {puedeSolicitarSync ? (
        <button
          type="button"
          disabled={procesandoGrilla || solicitando || grillaSync.sincronizando}
          onClick={() => void sincronizarSector?.()}
          className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {solicitando || grillaSync.sincronizando ? "Sincronizando…" : "Sincronizar sector"}
        </button>
      ) : null}
    </div>
  );
}

export default function GrillaSyncSectorBar(props) {
  const controls = useGrillaSyncSectorBar(props);
  if (!props.enabled) return null;
  return (
    <GrillaSyncSectorControls
      visible
      grillaSync={controls.grillaSync}
      syncEstadoListado={props.syncEstadoListado}
      listadoReconciliacionPendiente={controls.listadoReconciliacionPendiente}
      puedeSolicitarSync={props.puedeSolicitarSync}
      procesandoGrilla={props.procesandoGrilla}
      solicitando={controls.solicitando}
      sincronizarSector={controls.sincronizarSector}
      className={props.className}
    />
  );
}
