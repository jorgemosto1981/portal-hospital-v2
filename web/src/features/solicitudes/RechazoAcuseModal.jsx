import { useEffect, useState } from "react";

import {
  callObtenerContextoAcuseRechazoAgente,
  callRegistrarAcuseRechazoAgente,
} from "../../services/callables.js";
import { ymdToDdMmYyyy } from "./cambioDiaUi.js";
import {
  labelRolActorRechazo,
  textoFechasSolicitud,
  tituloSolicitudAgente,
} from "./misSolicitudesUi.js";
import { TICKETERA } from "./ticketeraUi.js";

/**
 * Modal bloqueante: toma de conocimiento de un rechazo.
 * @param {{
 *   sol: Record<string, unknown>;
 *   restantes: number;
 *   onAcusado?: (solId: string) => void;
 * }} props
 */
export default function RechazoAcuseModal({ sol, restantes, onAcusado }) {
  const solId = String(sol?.id || "").trim();
  const [ctx, setCtx] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSaving(false);
    setSaveError("");
    if (!/^sol_/i.test(solId)) {
      setCtx(null);
      setCtxLoading(false);
      return undefined;
    }
    setCtxLoading(true);
    setCtxError("");
    (async () => {
      try {
        const res = await callObtenerContextoAcuseRechazoAgente({ solicitud_id: solId });
        if (cancelled) return;
        const data = res?.data && typeof res.data === "object" ? res.data : null;
        setCtx(data);
        // Si el snapshot llegó tarde pero el doc ya tiene acuse, avanzar cola.
        if (data?.ya_acusado === true) {
          onAcusado?.(solId);
        }
      } catch (err) {
        if (cancelled) return;
        setCtx(null);
        setCtxError(err?.message || "No se pudo cargar el detalle del rechazo.");
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [solId, onAcusado]);

  async function onAcusar() {
    if (saving || !/^sol_/i.test(solId)) return;
    setSaving(true);
    setSaveError("");
    try {
      await callRegistrarAcuseRechazoAgente({ solicitud_id: solId });
      onAcusado?.(solId);
      // El gate remonta el modal del siguiente (key=solId) o cierra si no quedan.
    } catch (err) {
      setSaveError(err?.message || "No se pudo registrar la toma de conocimiento.");
      setSaving(false);
    }
  }

  const titulo =
    String(ctx?.articulo_label || "").trim() || tituloSolicitudAgente(sol) || "Solicitud rechazada";
  const fechas =
    ctx?.fecha_desde || ctx?.fecha_hasta
      ? [ymdToDdMmYyyy(ctx.fecha_desde), ymdToDdMmYyyy(ctx.fecha_hasta)]
          .filter(Boolean)
          .join(" → ") || "—"
      : textoFechasSolicitud(sol);
  const grupo = String(ctx?.grupo_label || sol.grupo_trabajo_id_ancla || "—");
  const revisorRaw = String(ctx?.revisor_label || "").trim();
  const revisor =
    revisorRaw && !/^per_/i.test(revisorRaw) ? revisorRaw : labelRolActorRechazo(sol);
  const motivo = String(ctx?.motivo || "").trim();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="acuse-rechazo-titulo"
      aria-describedby="acuse-rechazo-desc"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-200 bg-white p-4 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
          Novedad: solicitud rechazada
        </p>
        <h2 id="acuse-rechazo-titulo" className="mt-1 text-xl font-semibold text-slate-900">
          Debés tomar conocimiento
        </h2>
        <p id="acuse-rechazo-desc" className={`${TICKETERA.muted} mt-2`}>
          No podés continuar en el portal hasta registrar que leíste este rechazo
          {restantes > 1 ? ` (${restantes} pendientes)` : ""}.
        </p>

        {ctxLoading ? <p className={`${TICKETERA.muted} mt-4`}>Cargando detalle…</p> : null}
        {ctxError ? <div className={`${TICKETERA.alertError} mt-4`}>{ctxError}</div> : null}

        {!ctxLoading ? (
          <dl className="mt-4 space-y-2 text-base text-slate-800">
            <div>
              <dt className="text-sm font-medium text-slate-500">Trámite</dt>
              <dd className="font-semibold">{titulo}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Fechas</dt>
              <dd>{fechas}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Grupo</dt>
              <dd>{grupo}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Quién rechazó</dt>
              <dd className="font-semibold">{revisor}</dd>
            </div>
            {motivo ? (
              <div>
                <dt className="text-sm font-medium text-slate-500">Motivo</dt>
                <dd>{motivo}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {saveError ? <div className={`${TICKETERA.alertError} mt-4`}>{saveError}</div> : null}

        <button
          type="button"
          className={`${TICKETERA.btnPrimary} mt-5`}
          disabled={saving || ctxLoading || Boolean(ctxError)}
          onClick={onAcusar}
        >
          {saving ? "Registrando…" : "Tomé conocimiento"}
        </button>
      </div>
    </div>
  );
}
