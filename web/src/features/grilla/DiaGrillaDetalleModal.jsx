import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  callListarOverridesTurno,
  callObtenerResumenSolicitudArticuloGrilla,
  callRegistrarConsultaGestionTurnoGrilla,
} from "../../services/callables.js";
import {
  lineasPendienteEnCola,
  overrideActivoEnGrupo,
  overrideAfectaCelda,
  tarjetaResumenOverride,
} from "./grillaGestionTurnoHistorial.js";
import { mergePersonaLabelsDesdeOps } from "./grillaOutboxLabels.js";
import { horarioOperativoDesdeCeldaVis } from "./grillaHorarioInstitucional.js";

function labelEstado(id) {
  const e = String(id || "");
  if (e === "cfg_esa_aprobada") return "Aprobada";
  if (e === "cfg_esa_en_revision_jefe") return "En revisión por jefe";
  if (e === "cfg_esa_rechazada") return "Rechazada";
  if (e === "cfg_esa_en_revision_rrhh") return "En revisión RRHH (legacy)";
  return e || "—";
}

function planTurnoCorregirPath(grupoTrabajoId, fechaYmd) {
  const g = String(grupoTrabajoId || "").trim();
  const ymd = String(fechaYmd || "").trim();
  const periodo = ymd.length >= 7 ? ymd.slice(0, 7) : "";
  const params = new URLSearchParams();
  if (g) params.set("grupo_id", g);
  if (periodo) params.set("periodo", periodo);
  const q = params.toString();
  return `/portal/jefe/planes-turno${q ? `?${q}` : ""}`;
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
 *   onAbrirCambioTurno?: () => void;
 *   onAbrirGestionTurno?: () => void;
 *   puedeGestionarTurno?: boolean;
 *   soloLectura?: boolean;
 *   grupoTrabajoId?: string;
 *   opsOutboxPendientes?: Array<Record<string, unknown>>;
 *   personaLabels?: Record<string, string>;
 *   incompletoPlan?: boolean;
 *   desalineacionTeoria?: boolean;
 *   puedeCorregirPlan?: boolean;
 * }} props
 */
export default function DiaGrillaDetalleModal({
  open,
  onClose,
  dia,
  eventos,
  bandejaPath,
  subtitulo,
  turnoTeorico,
  grupoLabel,
  personaId,
  fechaYmd,
  onAbrirCobertura,
  onAbrirCambioTurno,
  onAbrirGestionTurno,
  puedeGestionarTurno = false,
  soloLectura = false,
  grupoTrabajoId = "",
  opsOutboxPendientes = [],
  personaLabels = {},
  incompletoPlan = false,
  desalineacionTeoria = false,
  puedeCorregirPlan = false,
}) {
  const corregirPlanTo = useMemo(
    () => planTurnoCorregirPath(grupoTrabajoId, fechaYmd),
    [grupoTrabajoId, fechaYmd],
  );
  const [solFocus, setSolFocus] = useState("");
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tarjetasGestion, setTarjetasGestion] = useState(/** @type {Array<ReturnType<typeof tarjetaResumenOverride>>} */ ([]));
  const [pendientesCola, setPendientesCola] = useState(/** @type {string[]} */ ([]));
  const [loadingGestion, setLoadingGestion] = useState(false);

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

  useEffect(() => {
    if (!open || !personaId || !fechaYmd) {
      setTarjetasGestion([]);
      setPendientesCola([]);
      return;
    }
    const labels = mergePersonaLabelsDesdeOps(opsOutboxPendientes, personaLabels);
    setPendientesCola(lineasPendienteEnCola(opsOutboxPendientes, personaId, fechaYmd, { personaLabels: labels }));
    let cancelled = false;
    setLoadingGestion(true);
    void (async () => {
      try {
        const res = await callListarOverridesTurno({
          persona_id: personaId,
          fecha: fechaYmd,
        });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const gdt = String(grupoTrabajoId || "").trim();
        const afectan = items.filter(
          (o) => overrideActivoEnGrupo(o, gdt) && overrideAfectaCelda(o, personaId, fechaYmd),
        );
        if (cancelled) return;
        const cards = afectan.map((o) => tarjetaResumenOverride(o, personaId, fechaYmd, { personaLabels: labels }));
        setTarjetasGestion(cards);
        if (afectan.length > 0) {
          const override_refs = afectan.map((o, i) => String(o.op_batch_id || o.creado_en || i));
          const op_batch_ids = [
            ...new Set(afectan.map((o) => String(o.op_batch_id || "").trim()).filter(Boolean)),
          ];
          await callRegistrarConsultaGestionTurnoGrilla({
            persona_id: personaId,
            fecha: fechaYmd,
            grupo_trabajo_id: gdt,
            override_refs,
            op_batch_ids,
          });
        }
      } catch {
        if (!cancelled) setTarjetasGestion([]);
      } finally {
        if (!cancelled) setLoadingGestion(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, personaId, fechaYmd, grupoTrabajoId, opsOutboxPendientes, personaLabels]);

  if (!open) return null;

  const lista = Array.isArray(eventos) ? eventos : [];
  const horarioTeorico = turnoTeorico?.capa_teorica
    ? horarioOperativoDesdeCeldaVis({
        rda_ingreso: turnoTeorico.capa_teorica.ingreso,
        rda_egreso: turnoTeorico.capa_teorica.egreso,
        rda_horario_display: turnoTeorico.capa_teorica.horario_display,
        rda_tiene_huecos: turnoTeorico.capa_teorica.tiene_huecos,
        segmentos: turnoTeorico.capa_teorica.segmentos,
        tiene_huecos: turnoTeorico.capa_teorica.tiene_huecos,
      })
    : "";

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
            Día {Number(dia)}
            {incompletoPlan && lista.length === 0 ? " — sin turno en plan" : " — licencias"}
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

        {incompletoPlan ? (
          <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3">
            <p className="text-sm text-rose-950">
              Este día laborable no tiene turno asignado en el plan mensual. Por favor, corrija la
              asignación desde la vista de Planes de Turno.
            </p>
            {lista.length > 0 ? (
              <p className="mt-2 text-xs font-medium text-rose-900">
                Licencia sobre plan incompleto (falta turno): revise la solicitud y regularice el plan
                antes de gestionar turno en este día.
              </p>
            ) : null}
          </div>
        ) : null}

        {incompletoPlan && puedeCorregirPlan ? (
          <Link
            to={corregirPlanTo}
            onClick={onClose}
            className="mt-4 flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-rose-700 text-base font-semibold text-white hover:bg-rose-800 active:bg-rose-900"
          >
            Corregir plan
          </Link>
        ) : null}

        {desalineacionTeoria && !incompletoPlan ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-950">Teoría modificada post-licencia</p>
            <p className="mt-1 text-xs text-amber-900">
              La jornada teórica vigente difiere de la referencia al registrar la licencia. Revisá la
              solicitud, ajustá el turno del día o derivá la corrección al plan mensual.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {resumen?.solicitud_id && bandejaPath ? (
                <Link
                  to={`${bandejaPath}?sol_id=${encodeURIComponent(resumen.solicitud_id)}`}
                  onClick={onClose}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-amber-400 bg-white text-sm font-semibold text-amber-950 active:bg-amber-100"
                >
                  Ir a solicitud en bandeja
                </Link>
              ) : null}
              {personaId && fechaYmd && puedeGestionarTurno && onAbrirGestionTurno && !soloLectura ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAbrirGestionTurno();
                  }}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white active:bg-violet-800"
                >
                  Ajustar turno del día
                </button>
              ) : soloLectura && desalineacionTeoria ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Mes en solo lectura: el ajuste de turno lo gestiona RRHH.
                </p>
              ) : null}
              {puedeCorregirPlan ? (
                <Link
                  to={corregirPlanTo}
                  onClick={onClose}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-900 active:bg-rose-100"
                >
                  Derivar a corrección de plan
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

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
                  {horarioTeorico ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Horario:</dt>
                      <dd className="text-slate-700">{horarioTeorico}</dd>
                    </div>
                  ) : null}
                  {turnoTeorico.capa_teorica.horas_efectivas != null ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Horas efectivas:</dt>
                      <dd className="text-slate-700">{turnoTeorico.capa_teorica.horas_efectivas}hs</dd>
                    </div>
                  ) : null}
                  {turnoTeorico.capa_teorica.fichadas_esperadas != null ? (
                    <div className="flex gap-2">
                      <dt className="font-medium text-slate-500">Fichadas esperadas:</dt>
                      <dd className="font-bold text-indigo-800">{turnoTeorico.capa_teorica.fichadas_esperadas}</dd>
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

        {loadingGestion ? (
          <p className="mt-3 text-xs text-slate-500">Cargando cambios de turno…</p>
        ) : null}

        {pendientesCola.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900">Pendiente en cola</h4>
            <ul className="mt-1.5 space-y-1 text-xs text-amber-950">
              {pendientesCola.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {tarjetasGestion.length > 0 ? (
          <div className="mt-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Cambios de turno en este día
            </h4>
            {tarjetasGestion.map((card, idx) => (
              <div
                key={`${card.enCaracterDe}-${idx}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800"
              >
                <p className="font-semibold text-slate-900">{card.enCaracterDe}</p>
                <p className="mt-1">{card.quePaso}</p>
                <p className="mt-0.5 text-slate-600">{card.conQuien}</p>
                <p className="mt-1 text-slate-500">{card.cuandoQuien}</p>
                {card.nota ? <p className="mt-1 italic text-slate-500">{card.nota}</p> : null}
                {card.referencia ? (
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{card.referencia}</p>
                ) : null}
              </div>
            ))}
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
        {personaId && fechaYmd && puedeGestionarTurno && onAbrirGestionTurno && !desalineacionTeoria ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onAbrirGestionTurno();
            }}
            className="mt-4 flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-violet-700 text-base font-semibold text-white active:bg-violet-800"
          >
            Gestionar turno de este día
          </button>
        ) : null}
        {personaId && fechaYmd && puedeGestionarTurno && onAbrirCobertura && !onAbrirGestionTurno && !soloLectura ? (
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
        {personaId && fechaYmd && puedeGestionarTurno && onAbrirCambioTurno && !onAbrirGestionTurno && !soloLectura ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onAbrirCambioTurno();
            }}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900 active:bg-amber-100"
          >
            Cambio de turno (reemplazo / adicional)
          </button>
        ) : null}

        {resumen?.solicitud_id && bandejaPath && !desalineacionTeoria ? (
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
