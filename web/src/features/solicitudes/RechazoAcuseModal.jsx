import { useEffect, useState } from "react";

import {
  callObtenerContextoAcuseRechazoAgente,
  callObtenerContextoAcuseSinGoceAgente,
  callRegistrarAcuseRechazoAgente,
  callRegistrarAcuseSinGoceAgente,
} from "../../services/callables.js";
import { ymdToDdMmYyyy } from "./cambioDiaUi.js";
import {
  esDecisionJefeObservado,
  labelRolActorRechazo,
  requiereAcuseSinGoce,
  textoFechasSolicitud,
  tituloSolicitudAgente,
} from "./misSolicitudesUi.js";
import { TICKETERA } from "./ticketeraUi.js";

/**
 * Modal bloqueante: toma de conocimiento de rechazo / observación / autorización sin goce.
 * @param {{
 *   sol: Record<string, unknown>;
 *   restantes: number;
 *   onAcusado?: (solId: string) => void;
 * }} props
 */
export default function RechazoAcuseModal({ sol, restantes, onAcusado }) {
  const solId = String(sol?.id || "").trim();
  const esSinGoce =
    sol?._acuseTipo === "sin_goce" || requiereAcuseSinGoce(sol);
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
        const res = esSinGoce
          ? await callObtenerContextoAcuseSinGoceAgente({ solicitud_id: solId })
          : await callObtenerContextoAcuseRechazoAgente({ solicitud_id: solId });
        if (cancelled) return;
        const data = res?.data && typeof res.data === "object" ? res.data : null;
        setCtx(data);
        if (data?.ya_acusado === true) {
          onAcusado?.(solId);
        }
      } catch (err) {
        if (cancelled) return;
        setCtx(null);
        setCtxError(
          err?.message ||
            (esSinGoce
              ? "No se pudo cargar el detalle de la autorización."
              : "No se pudo cargar el detalle del rechazo."),
        );
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [solId, esSinGoce, onAcusado]);

  async function onAcusar() {
    if (saving || !/^sol_/i.test(solId)) return;
    setSaving(true);
    setSaveError("");
    try {
      if (esSinGoce) {
        await callRegistrarAcuseSinGoceAgente({ solicitud_id: solId });
      } else {
        await callRegistrarAcuseRechazoAgente({ solicitud_id: solId });
      }
      onAcusado?.(solId);
    } catch (err) {
      setSaveError(err?.message || "No se pudo registrar la toma de conocimiento.");
      setSaving(false);
    }
  }

  const esObservado =
    !esSinGoce &&
    (ctx?.es_observacion_jefe === true || esDecisionJefeObservado(sol));
  const titulo =
    String(ctx?.articulo_label || "").trim() ||
    tituloSolicitudAgente(sol) ||
    (esSinGoce
      ? "Autorizada sin goce de haberes"
      : esObservado
        ? "Solicitud observada"
        : "Solicitud rechazada");
  const fechas =
    ctx?.fecha_desde || ctx?.fecha_hasta
      ? [ymdToDdMmYyyy(ctx.fecha_desde), ymdToDdMmYyyy(ctx.fecha_hasta)]
          .filter(Boolean)
          .join(" → ") || "—"
      : textoFechasSolicitud(sol);
  const grupo = String(ctx?.grupo_label || sol.grupo_trabajo_id_ancla || "—");
  const revisorRaw = String(ctx?.revisor_label || "").trim();
  const revisor =
    revisorRaw && !/^per_/i.test(revisorRaw)
      ? revisorRaw
      : esSinGoce
        ? "Jefatura"
        : labelRolActorRechazo(sol);
  const motivo = String(ctx?.motivo || "").trim();

  const eyebrow = esSinGoce
    ? "Novedad: autorizada sin goce"
    : esObservado
      ? "Novedad: solicitud observada"
      : "Novedad: solicitud rechazada";
  const desc = esSinGoce
    ? "No podés continuar en el portal hasta registrar que leíste esta autorización sin goce de haberes"
    : esObservado
      ? "No podés continuar en el portal hasta registrar que leíste esta observación"
      : "No podés continuar en el portal hasta registrar que leíste este rechazo";

  const borderTone = esSinGoce ? "border-amber-200" : "border-rose-200";
  const eyebrowTone = esSinGoce ? "text-amber-800" : "text-rose-700";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="acuse-novedad-titulo"
      aria-describedby="acuse-novedad-desc"
    >
      <div className={`max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border ${borderTone} bg-white p-4 shadow-xl`}>
        <p className={`text-xs font-semibold uppercase tracking-wide ${eyebrowTone}`}>
          {eyebrow}
        </p>
        <h2 id="acuse-novedad-titulo" className="mt-1 text-xl font-semibold text-slate-900">
          Debés tomar conocimiento
        </h2>
        <p id="acuse-novedad-desc" className={`${TICKETERA.muted} mt-2`}>
          {desc}
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
              <dd>{fechas || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Grupo</dt>
              <dd>{grupo}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">
                {esSinGoce ? "Quién autorizó" : esObservado ? "Quién observó" : "Quién rechazó"}
              </dt>
              <dd className="font-semibold">{revisor}</dd>
            </div>
            {motivo ? (
              <div>
                <dt className="text-sm font-medium text-slate-500">
                  {esSinGoce ? "Justificativo" : "Motivo"}
                </dt>
                <dd>{motivo}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {!ctxLoading && esSinGoce ? (
          <div
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-base text-amber-950"
            role="status"
          >
            <p className="font-semibold">Sin goce de haberes</p>
            <p className="mt-1">
              {String(ctx?.sin_goce_mensaje || "").trim() ||
                "Tu jefatura autorizó la ausencia sin goce de haberes (Art. 64-B). No es un rechazo: el día queda justificado, pero sin sueldo."}
            </p>
          </div>
        ) : null}

        {!ctxLoading && !esSinGoce && ctx?.genera_inasistencia_injustificada === true ? (
          <div
            className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-3 text-base text-rose-950"
            role="status"
          >
            <p className="font-semibold">Inasistencia injustificada</p>
            <p className="mt-1">
              {String(ctx.inasistencia_injustificada_mensaje || "").trim() ||
                "Este rechazo generó el registro de una inasistencia injustificada para las mismas fechas."}
            </p>
          </div>
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
