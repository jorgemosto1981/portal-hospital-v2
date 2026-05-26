import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import {
  callListarPlanesTurnoServicio,
  callGuardarPlanTurnoServicio,
  callEnviarPlanTurnoServicio,
  callAprobarPlanTurnoServicio,
  callRechazarPlanTurnoServicio,
  callHabilitarPlanTurnoServicio,
  callCerrarPlanPerpetuo,
} from "../../services/callables.js";
import GrillaMensualEditor from "./planes/GrillaMensualEditor.jsx";
import PlanPerpetualViewer from "./planes/PlanPerpetualViewer.jsx";
import BandejaAprobaciones from "./planes/BandejaAprobaciones.jsx";

const BADGE_ESTADO = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-blue-100 text-blue-800",
  AUTORIZADO_SUPERIOR: "bg-amber-100 text-amber-800",
  HABILITADO: "bg-green-100 text-green-800",
  CERRADO: "bg-red-100 text-red-700",
};
const LABEL_ESTADO = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  AUTORIZADO_SUPERIOR: "Autorizado",
  HABILITADO: "Habilitado",
  CERRADO: "Cerrado",
};

function BadgeEstado({ estado }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_ESTADO[estado] || "bg-slate-100 text-slate-600"}`}>
      {LABEL_ESTADO[estado] || estado}
    </span>
  );
}

function periodoActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PlanTurnoServicioPage() {
  const [tab, setTab] = useState("planes");
  const [grupoId, setGrupoId] = useState("");
  const [periodo, setPeriodo] = useState(periodoActual());
  const [filtroEstado, setFiltroEstado] = useState("");
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [planEdicion, setPlanEdicion] = useState(null);
  const [planDetalle, setPlanDetalle] = useState(null);
  const [operando, setOperando] = useState(false);

  const cargar = useCallback(async () => {
    if (!grupoId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await callListarPlanesTurnoServicio({
        grupo_id: grupoId.trim(),
        estado: filtroEstado || undefined,
        periodo: periodo || undefined,
      });
      setPlanes(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar planes.");
    } finally {
      setLoading(false);
    }
  }, [grupoId, filtroEstado, periodo]);

  useEffect(() => {
    if (grupoId.trim()) cargar();
  }, [cargar, grupoId]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4000);
  };

  const handleGuardarBorrador = useCallback(async (datos, existingId) => {
    setOperando(true);
    try {
      const res = await callGuardarPlanTurnoServicio({ datos, id: existingId || undefined });
      showFeedback(`Plan ${res.data?.modo || "guardado"} (${res.data?.id}).`);
      setPlanEdicion(null);
      await cargar();
    } catch (e) {
      setError(e?.message || "Error al guardar.");
    } finally {
      setOperando(false);
    }
  }, [cargar]);

  const handleTransicion = useCallback(async (accion, planId, extras) => {
    setOperando(true);
    try {
      let res;
      switch (accion) {
        case "enviar":
          res = await callEnviarPlanTurnoServicio({ plan_id: planId });
          if (res.data?.warnings?.length) {
            showFeedback(`Enviado con ${res.data.warnings.length} advertencia(s).`);
          } else {
            showFeedback("Plan enviado para aprobación.");
          }
          break;
        case "aprobar":
          res = await callAprobarPlanTurnoServicio({ plan_id: planId, observaciones: extras?.observaciones });
          showFeedback("Plan aprobado por superior.");
          break;
        case "rechazar":
          res = await callRechazarPlanTurnoServicio({ plan_id: planId, observaciones: extras?.observaciones });
          showFeedback("Plan rechazado, devuelto a borrador.");
          break;
        case "habilitar":
          res = await callHabilitarPlanTurnoServicio({
            plan_id: planId,
            confirmar_invalidar_overrides: extras?.confirmar === true,
          });
          if (res.data?.requiere_confirmacion) {
            const ok = window.confirm(res.data.mensaje);
            if (ok) {
              await handleTransicion("habilitar", planId, { confirmar: true });
              return;
            }
            showFeedback("Habilitación cancelada.");
            break;
          }
          showFeedback("Plan habilitado.");
          break;
        case "cerrar":
          res = await callCerrarPlanPerpetuo({ plan_id: planId, fecha_cierre: extras?.fecha_cierre });
          showFeedback("Plan perpetuo cerrado.");
          break;
        default:
          break;
      }
      await cargar();
    } catch (e) {
      setError(e?.message || `Error en acción ${accion}.`);
    } finally {
      setOperando(false);
    }
  }, [cargar]);

  const resumenEstados = useMemo(() => {
    const r = { BORRADOR: 0, ENVIADO: 0, AUTORIZADO_SUPERIOR: 0, HABILITADO: 0, CERRADO: 0 };
    for (const p of planes) if (r[p.estado] != null) r[p.estado]++;
    return r;
  }, [planes]);

  const TABS = [
    { id: "planes", label: "Mis planes" },
    { id: "bandeja", label: "Bandeja aprobaciones" },
  ];

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Planes de turno
            </h1>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
              Planificación mensual (servicios con régimen planificado) y planes perpetuos (fijo/rotativo).
              Máquina de estados: Borrador → Enviado → Autorizado → Habilitado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlanEdicion({ nuevo: true, tipo_plan: "mensual" })}
            disabled={!grupoId.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo plan
          </button>
        </div>
      </header>

      {/* Filtros */}
      <Card className="px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Grupo de trabajo</label>
            <input
              type="text"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              placeholder="ID del grupo…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">Período</label>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ENVIADO">Enviado</option>
              <option value="AUTORIZADO_SUPERIOR">Autorizado</option>
              <option value="HABILITADO">Habilitado</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={loading || !grupoId.trim()}
            className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "…" : "Buscar"}
          </button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Object.entries(resumenEstados).map(([est, n]) => (
          <Card key={est} className="px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{LABEL_ESTADO[est]}</p>
            <p className="text-2xl font-bold text-slate-900">{n}</p>
          </Card>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {feedback}
        </div>
      )}
      {error && (
        <Card className="border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError("")} className="mt-1 text-xs text-red-600 underline">
            Cerrar
          </button>
        </Card>
      )}

      {/* Contenido según tab */}
      {tab === "planes" && (
        <>
          {loading && (
            <Card className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">Cargando planes…</p>
            </Card>
          )}
          {!loading && planes.length === 0 && grupoId.trim() && (
            <Card className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No hay planes para este grupo/período.</p>
            </Card>
          )}
          {!loading && planes.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Período</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Agentes</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {planes.map((plan) => (
                      <tr key={plan.id} className="transition hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="font-mono text-xs text-slate-600">{plan.id}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {plan.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-700">
                          {plan.periodo || `${plan.vigente_desde || "—"} → ${plan.vigente_hasta || "∞"}`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-slate-600">
                          {plan.agentes?.length || 0}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <BadgeEstado estado={plan.estado} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => setPlanDetalle(plan)}
                              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                            >
                              Ver
                            </button>
                            {plan.estado === "BORRADOR" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPlanEdicion(plan)}
                                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  disabled={operando}
                                  onClick={() => handleTransicion("enviar", plan.id)}
                                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                                >
                                  Enviar
                                </button>
                              </>
                            )}
                            {plan.estado === "HABILITADO" && plan.tipo_plan === "perpetuo" && (
                              <button
                                type="button"
                                disabled={operando}
                                onClick={() => handleTransicion("cerrar", plan.id)}
                                className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                              >
                                Cerrar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "bandeja" && (
        <BandejaAprobaciones
          planes={planes.filter((p) => p.estado === "ENVIADO" || p.estado === "AUTORIZADO_SUPERIOR")}
          onTransicion={handleTransicion}
          operando={operando}
        />
      )}

      {/* Modal Grilla Mensual / Plan Perpetuo */}
      {planEdicion && planEdicion.tipo_plan === "mensual" && (
        <GrillaMensualEditor
          plan={planEdicion.nuevo ? null : planEdicion}
          grupoId={grupoId}
          periodo={periodo}
          guardando={operando}
          onGuardar={handleGuardarBorrador}
          onCerrar={() => setPlanEdicion(null)}
        />
      )}
      {planEdicion && planEdicion.tipo_plan === "perpetuo" && (
        <PlanPerpetualViewer
          plan={planEdicion.nuevo ? null : planEdicion}
          grupoId={grupoId}
          guardando={operando}
          onGuardar={handleGuardarBorrador}
          onCerrar={() => setPlanEdicion(null)}
        />
      )}

      {/* Modal detalle read-only */}
      {planDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPlanDetalle(null)}>
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Detalle del plan <span className="font-mono text-sm text-slate-500">{planDetalle.id}</span>
              </h2>
              <button onClick={() => setPlanDetalle(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-medium">Tipo:</span> {planDetalle.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}</p>
              <p><span className="font-medium">Estado:</span> <BadgeEstado estado={planDetalle.estado} /></p>
              <p><span className="font-medium">Grupo:</span> {planDetalle.grupo_id}</p>
              {planDetalle.periodo && <p><span className="font-medium">Período:</span> {planDetalle.periodo}</p>}
              {planDetalle.vigente_desde && (
                <p><span className="font-medium">Vigencia:</span> {planDetalle.vigente_desde} → {planDetalle.vigente_hasta || "∞"}</p>
              )}
              <p><span className="font-medium">Agentes:</span> {planDetalle.agentes?.length || 0}</p>
              {planDetalle.observaciones_rechazo && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  <p className="text-xs font-medium">Observaciones de rechazo:</p>
                  <p>{planDetalle.observaciones_rechazo}</p>
                </div>
              )}
              {planDetalle.tipo_plan === "mensual" && planDetalle.agentes?.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Grilla de asignaciones</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-slate-500">Agente</th>
                          {planDetalle.agentes[0]?.dias && Object.keys(planDetalle.agentes[0].dias).sort().map((d) => (
                            <th key={d} className="px-1 py-1 text-center font-medium text-slate-400">{d.slice(-2)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {planDetalle.agentes.map((ag) => (
                          <tr key={ag.persona_id}>
                            <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-600">{ag.persona_id}</td>
                            {ag.dias && Object.keys(ag.dias).sort().map((d) => {
                              const cel = ag.dias[d];
                              const esFranco = cel.tipo_dia === "franco" || cel.tipo_dia === "no_laborable";
                              const color = esFranco ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-700";
                              return (
                                <td key={d} className={`px-1 py-1 text-center font-medium ${color}`}>
                                  {esFranco ? "F" : cel.turno_id || "?"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {planDetalle.historial_aprobaciones?.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Historial de aprobaciones</h3>
                  <div className="space-y-1">
                    {planDetalle.historial_aprobaciones.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600">
                        <span className="font-medium capitalize">{h.accion}</span>
                        <span className="text-slate-400">por</span>
                        <span className="font-mono">{h.actor_uid?.slice(0, 12)}…</span>
                        <span className="text-slate-400">({h.rol})</span>
                        <span className="ml-auto text-slate-400">{h.fecha}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
