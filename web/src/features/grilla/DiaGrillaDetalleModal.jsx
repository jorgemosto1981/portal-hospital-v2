import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { callObtenerResumenSolicitudArticuloGrilla } from "../../services/callables.js";

function labelEstado(id) {
  const e = String(id || "");
  if (e === "cfg_esa_aprobada") return "Aprobada";
  if (e === "cfg_esa_en_revision_jefe") return "En revisión por jefe";
  if (e === "cfg_esa_rechazada") return "Rechazada";
  if (e === "cfg_esa_en_revision_rrhh") return "En revisión RRHH (legacy)";
  return e || "—";
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   dia: string;
 *   eventos: Array<Record<string, unknown>>;
 *   bandejaPath: string;
 *   subtitulo?: string;
 *   turnoTeorico?: { rda_turno_id?: string; es_franco?: boolean; capa_teorica?: Record<string, unknown> } | null;
 *   personaId?: string;
 *   fechaYmd?: string;
 *   onAbrirCobertura?: () => void;
 *   soloLectura?: boolean;
 * }} props
 */
export default function DiaGrillaDetalleModal({
  open, onClose, dia, eventos, bandejaPath, subtitulo, turnoTeorico, grupoLabel, personaId, fechaYmd, onAbrirCobertura, soloLectura = false,
}) {
  const [solFocus, setSolFocus] = useState("");
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSolFocus("");
      setResumen(null);
      return;
    }
    const first = Array.isArray(eventos) && eventos[0] ? String(eventos[0].solicitud_id || "") : "";
    if (first) setSolFocus(first);
  }, [open, eventos]);

  useEffect(() => {
    if (!open || !solFocus) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await callObtenerResumenSolicitudArticuloGrilla({ solicitud_id: solFocus });
        if (!cancelled) setResumen(res?.data || null);
      } catch (e) {
        if (!cancelled) {
          setResumen(null);
          toast.error(e?.message || "No se pudo cargar el resumen.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, solFocus]);

  if (!open) return null;

  const lista = Array.isArray(eventos) ? eventos : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dia-grilla-titulo"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div className="relative z-10 max-h-[min(90vh,32rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <h3 id="dia-grilla-titulo" className="text-lg font-semibold text-slate-900">
            Día {Number(dia)} — licencias
            {subtitulo ? (
              <span className="mt-0.5 block text-sm font-normal text-slate-600">{subtitulo}</span>
            ) : null}
            {grupoLabel ? (
              <span className="mt-0.5 block text-xs font-normal text-violet-600">{grupoLabel}</span>
            ) : null}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        {turnoTeorico && (turnoTeorico.rda_turno_id || turnoTeorico.es_franco || turnoTeorico.capa_teorica) ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600">Turno teorico</h4>
            <dl className="space-y-1 text-xs">
              {turnoTeorico.rda_turno_id ? (
                <div className="flex gap-2">
                  <dt className="font-medium text-slate-500">Turno:</dt>
                  <dd className="font-bold text-indigo-700">{turnoTeorico.rda_turno_id}</dd>
                </div>
              ) : null}
              {turnoTeorico.es_franco ? (
                <div className="flex gap-2">
                  <dt className="font-medium text-slate-500">Tipo:</dt>
                  <dd className="text-slate-600">Franco / No laborable</dd>
                </div>
              ) : null}
              {turnoTeorico.capa_teorica ? (
                <>
                  {turnoTeorico.capa_teorica.tipo_dia ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Tipo dia:</dt>
                      <dd className="capitalize text-slate-700">{turnoTeorico.capa_teorica.tipo_dia}</dd>
                    </div>
                  ) : null}
                  {turnoTeorico.capa_teorica.ingreso && turnoTeorico.capa_teorica.egreso ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Horario:</dt>
                      <dd className="text-slate-700">{turnoTeorico.capa_teorica.ingreso} — {turnoTeorico.capa_teorica.egreso}</dd>
                    </div>
                  ) : null}
                  {turnoTeorico.capa_teorica.horas_efectivas != null ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Horas efectivas:</dt>
                      <dd className="text-slate-700">{turnoTeorico.capa_teorica.horas_efectivas}hs</dd>
                    </div>
                  ) : null}
                  {turnoTeorico.capa_teorica.origen ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Origen:</dt>
                      <dd className="text-slate-600">{turnoTeorico.capa_teorica.origen}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </div>
        ) : null}

        {lista.length > 1 ? (
          <ul className="mt-3 space-y-1">
            {lista.map((ev) => {
              const sid = String(ev.solicitud_id || "");
              const active = sid === solFocus;
              return (
                <li key={sid}>
                  <button
                    type="button"
                    onClick={() => setSolFocus(sid)}
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-left text-sm",
                      active ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="font-mono text-xs text-slate-600">{sid}</span>
                    <span className="ml-2 font-semibold text-slate-800">{String(ev.codigo_grilla || "—")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {loading ? <p className="mt-4 text-sm text-slate-500">Cargando resumen…</p> : null}

        {resumen && !loading ? (
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">Solicitud</dt>
              <dd className="font-mono text-slate-800">{resumen.solicitud_id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Artículo</dt>
              <dd>{resumen.articulo_label || resumen.articulo_id || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Estado</dt>
              <dd>{labelEstado(resumen.estado_solicitud_id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Período</dt>
              <dd>
                {resumen.fecha_desde || "—"}
                {resumen.fecha_hasta && resumen.fecha_hasta !== resumen.fecha_desde
                  ? ` → ${resumen.fecha_hasta}`
                  : ""}
                {resumen.dias_solicitados != null ? ` · ${resumen.dias_solicitados} día(s)` : ""}
              </dd>
            </div>
            {resumen.jefe_revision_persona_id ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">Cierre jefatura</dt>
                <dd>
                  {resumen.jefe_revision_label || resumen.jefe_revision_persona_id}
                </dd>
              </div>
            ) : null}
            {resumen.rrhh_toma_conocimiento_persona_id ? (
              <div>
                <dt className="text-xs font-medium text-slate-500">Toma conocimiento RRHH</dt>
                <dd>
                  {resumen.rrhh_toma_conocimiento_label || resumen.rrhh_toma_conocimiento_persona_id}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {soloLectura ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Este mes está en solo lectura. Los cambios de turno los gestiona RRHH.
          </p>
        ) : null}
        {personaId && fechaYmd && onAbrirCobertura && !soloLectura ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onAbrirCobertura();
            }}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-800 active:bg-indigo-100"
          >
            Cobertura parcial por tramos
          </button>
        ) : null}

        {resumen?.solicitud_id && bandejaPath ? (
          <Link
            to={`${bandejaPath}?sol_id=${encodeURIComponent(resumen.solicitud_id)}`}
            onClick={onClose}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Ver solicitud en bandeja
          </Link>
        ) : null}
      </div>
    </div>
  );
}
