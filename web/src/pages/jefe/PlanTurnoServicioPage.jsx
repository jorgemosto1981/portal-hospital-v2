import { useCallback, useEffect, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import {
  callListarPlanesTurnoServicio,
  callGuardarPlanTurnoServicio,
  callEnviarPlanTurnoServicio,
  callAprobarPlanTurnoServicio,
  callRechazarPlanTurnoServicio,
  callCerrarPlanPerpetuo,
  callResolverContextoLaboralSolicitud,
} from "../../services/callables.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { claimsIncludeRrhh } from "../../features/routing/portalRole.js";
import GrillaMensualEditor from "./planes/GrillaMensualEditor.jsx";
import PlanPerpetualViewer from "./planes/PlanPerpetualViewer.jsx";
import BandejaAprobaciones from "./planes/BandejaAprobaciones.jsx";
import { filtrarPlanesBandejaJefe } from "./planes/planBandejaUtils.js";
import BadgeEstadoPlan, { LABEL_ESTADO } from "../../components/ui/BadgeEstadoPlan.jsx";

function periodoActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function desplazarPeriodo(periodo, deltaMeses) {
  const [anio, mes] = String(periodo || periodoActual()).split("-").map(Number);
  const dt = new Date(anio, (mes || 1) - 1 + deltaMeses, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function tituloPlan(plan, grupoLabelFallback = "") {
  const periodo = plan?.periodo ? `Período: ${plan.periodo}` : "Período: —";
  const grupo = plan?.grupo_label || grupoLabelFallback || plan?.grupo_id || "—";
  return `${periodo} — Grupo: ${grupo}`;
}

function estadoPrincipalGrupo(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.some((p) => p.estado === "EN_REVISION")) return "EN_REVISION";
  if (list.some((p) => p.estado === "ENVIADO")) return "ENVIADO";
  if (list.some((p) => p.estado === "BORRADOR")) return "BORRADOR";
  if (list.some((p) => p.estado === "HABILITADO")) return "HABILITADO";
  if (list.some((p) => p.estado === "CERRADO")) return "CERRADO";
  return "SIN_PLAN";
}

function estiloTarjetaGrupo(estado, activo) {
  const baseActivo = activo ? "ring-2 ring-offset-1" : "";
  switch (estado) {
    case "EN_REVISION":
      return activo
        ? `border-amber-300 bg-amber-50 text-amber-900 ring-amber-300 ${baseActivo}`
        : "border-amber-200 bg-amber-50/70 text-amber-900 hover:border-amber-300";
    case "ENVIADO":
      return activo
        ? `border-blue-300 bg-blue-50 text-blue-900 ring-blue-300 ${baseActivo}`
        : "border-blue-200 bg-blue-50/70 text-blue-900 hover:border-blue-300";
    case "BORRADOR":
      return activo
        ? `border-violet-300 bg-violet-50 text-violet-900 ring-violet-300 ${baseActivo}`
        : "border-violet-200 bg-violet-50/70 text-violet-900 hover:border-violet-300";
    case "HABILITADO":
      return activo
        ? `border-emerald-300 bg-emerald-50 text-emerald-900 ring-emerald-300 ${baseActivo}`
        : "border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300";
    case "CERRADO":
      return activo
        ? `border-slate-400 bg-slate-100 text-slate-900 ring-slate-300 ${baseActivo}`
        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300";
    default:
      return activo
        ? `border-indigo-300 bg-indigo-50 text-indigo-900 ring-indigo-300 ${baseActivo}`
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300";
  }
}

function iconoEstadoGrupo(estado) {
  switch (estado) {
    case "EN_REVISION":
      return "⚠";
    case "ENVIADO":
      return "📤";
    case "BORRADOR":
      return "✍";
    case "HABILITADO":
      return "✅";
    case "CERRADO":
      return "🔒";
    default:
      return "•";
  }
}

function etiquetaGrupo(row) {
  return String(row.nombre || row.codigo || row.titulo || "").trim() || String(row.id || row.grupo_de_trabajo_id || "");
}

export default function PlanTurnoServicioPage() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const personaId = String(claims?.persona_id || "").trim();

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
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposCargando, setGruposCargando] = useState(false);
  const [resumenGrupoPeriodo, setResumenGrupoPeriodo] = useState({});
  const [bandejaPlanes, setBandejaPlanes] = useState([]);
  const [bandejaLoading, setBandejaLoading] = useState(false);
  const [bandejaEstado, setBandejaEstado] = useState("");
  const [bandejaGrupo, setBandejaGrupo] = useState("");
  const [bandejaPage, setBandejaPage] = useState(1);
  const periodosPermitidos = useMemo(() => {
    const base = periodoActual();
    return [desplazarPeriodo(base, -1), base, desplazarPeriodo(base, 1)];
  }, []);

  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;
    setGruposCargando(true);

    (async () => {
      try {
        if (esRrhh) {
          const rows = await listarColeccionLaboral("grupos_de_trabajo", 400);
          if (cancelled) return;
          const activos = rows.filter((r) => r.activo !== false);
          activos.sort((a, b) => etiquetaGrupo(a).localeCompare(etiquetaGrupo(b), "es"));
          setGruposDisponibles(activos.map((r) => ({
            id: r.id,
            label: etiquetaGrupo(r),
          })));
        } else {
          const fechaCorte = `${periodoActual()}-28`;
          const res = await callResolverContextoLaboralSolicitud({
            persona_id: personaId,
            fecha_desde: fechaCorte,
          });
          if (cancelled) return;
          const list = res?.data?.grupos_trabajo_vigentes || [];
          const vigentes = Array.isArray(list) ? list : [];
          setGruposDisponibles(vigentes.map((g) => ({
            id: g.grupo_de_trabajo_id,
            label: g.etiqueta_ui || g.grupo_de_trabajo_id,
          })));
          if (vigentes.length === 1) {
            setGrupoId(vigentes[0].grupo_de_trabajo_id);
          }
        }
      } catch {
        // silencioso: el select queda vacío
      } finally {
        if (!cancelled) setGruposCargando(false);
      }
    })();

    return () => { cancelled = true; };
  }, [personaId, esRrhh]);

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

  const cargarBandejaAprobaciones = useCallback(async () => {
    if (!gruposDisponibles.length) {
      setBandejaPlanes([]);
      return;
    }
    setBandejaLoading(true);
    try {
      const resultados = await Promise.all(
        gruposDisponibles.slice(0, 60).map(async (g) => {
          try {
            const res = await callListarPlanesTurnoServicio({
              grupo_id: g.id,
              periodo,
            });
            return (res?.data?.items || []).map((p) => ({
              ...p,
              grupo_label: p.grupo_label || g.label || p.grupo_id,
            }));
          } catch {
            return [];
          }
        }),
      );
      const merged = resultados.flat();
      const prioridad = { ENVIADO: 0, EN_REVISION: 1, BORRADOR: 2, HABILITADO: 3, CERRADO: 4 };
      merged.sort((a, b) => {
        const pa = prioridad[a.estado] ?? 99;
        const pb = prioridad[b.estado] ?? 99;
        if (pa !== pb) return pa - pb;
        return String(a.grupo_label || "").localeCompare(String(b.grupo_label || ""), "es");
      });
      setBandejaPlanes(merged);
      setBandejaPage(1);
    } finally {
      setBandejaLoading(false);
    }
  }, [gruposDisponibles, periodo]);

  useEffect(() => {
    if (!gruposDisponibles.length || !periodo) {
      setResumenGrupoPeriodo({});
      return;
    }
    let cancel = false;
    (async () => {
      const gruposObjetivo = gruposDisponibles.slice(0, 30);
      const resultados = await Promise.all(
        gruposObjetivo.map(async (g) => {
          try {
            const res = await callListarPlanesTurnoServicio({
              grupo_id: g.id,
              periodo,
            });
            const items = res?.data?.items || [];
            return [g.id, { estado: estadoPrincipalGrupo(items), cantidad: items.length }];
          } catch {
            return [g.id, { estado: "SIN_PLAN", cantidad: 0 }];
          }
        }),
      );
      if (cancel) return;
      setResumenGrupoPeriodo(Object.fromEntries(resultados));
    })();
    return () => {
      cancel = true;
    };
  }, [gruposDisponibles, periodo]);

  useEffect(() => {
    if (grupoId.trim()) cargar();
  }, [cargar, grupoId]);

  useEffect(() => {
    if (tab !== "bandeja") return;
    cargarBandejaAprobaciones();
  }, [tab, cargarBandejaAprobaciones]);

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
          if (!extras?.confirmarEnvio) {
            const confirmar = window.confirm(
              "Vas a enviar el plan para aprobación. Luego no podrás editarlo hasta que el superior o RRHH lo resuelva. ¿Continuar?",
            );
            if (!confirmar) {
              showFeedback("Envío cancelado.");
              break;
            }
            const confirmar2 = window.confirm(
              "Confirmación final: ¿seguro que querés ENVIAR este plan ahora?",
            );
            if (!confirmar2) {
              showFeedback("Envío cancelado.");
              break;
            }
          }
          res = await callEnviarPlanTurnoServicio({ plan_id: planId });
          if (res.data?.mensaje_bandeja) {
            showFeedback(res.data.mensaje_bandeja);
          } else if (res.data?.warnings?.length) {
            showFeedback(`Enviado con ${res.data.warnings.length} advertencia(s).`);
          } else {
            showFeedback("Plan enviado para aprobación.");
          }
          break;
        case "aprobar":
          res = await callAprobarPlanTurnoServicio({
            plan_id: planId,
            observaciones: extras?.observaciones,
            confirmar_invalidar_overrides: extras?.confirmar === true,
          });
          if (res.data?.requiere_confirmacion) {
            const detalle = Array.isArray(res.data?.detalle_overrides) ? res.data.detalle_overrides : [];
            const detalleTxt = detalle
              .slice(0, 10)
              .map((o) => `- ${o.persona_id} · ${o.fecha} · ${o.cantidad} override(s)`)
              .join("\n");
            const extraLinea = detalle.length > 10
              ? `\n... y ${detalle.length - 10} override(s) más.`
              : "";
            const ok = window.confirm(
              `${res.data.mensaje}\n\nOverrides detectados:\n${detalleTxt || "- (sin detalle)"}${extraLinea}`,
            );
            if (ok) {
              await handleTransicion("aprobar", planId, { ...extras, confirmar: true });
              return;
            }
            showFeedback("Aprobación cancelada.");
            break;
          }
          if (res.data?.warnings?.length) {
            showFeedback(`Plan aprobado y habilitado con ${res.data.warnings.length} advertencia(s).`);
          } else {
            showFeedback("Plan aprobado y habilitado.");
          }
          break;
        case "rechazar":
          res = await callRechazarPlanTurnoServicio({ plan_id: planId, observaciones: extras?.observaciones });
          showFeedback("Plan rechazado, devuelto a borrador.");
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

  const grupoLabel = useMemo(() => {
    const g = gruposDisponibles.find((x) => x.id === grupoId);
    return g?.label || grupoId;
  }, [gruposDisponibles, grupoId]);

  const planesBandejaJefe = useMemo(
    () => filtrarPlanesBandejaJefe(bandejaPlanes, personaId),
    [bandejaPlanes, personaId],
  );

  const gruposBandeja = useMemo(() => {
    const map = new Map();
    for (const p of planesBandejaJefe) {
      const gid = String(p.grupo_id || "").trim();
      if (!gid || map.has(gid)) continue;
      map.set(gid, p.grupo_label || gid);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [planesBandejaJefe]);

  const planesBandejaFiltrados = useMemo(() => {
    return planesBandejaJefe.filter((p) => {
      if (bandejaEstado && p.estado !== bandejaEstado) return false;
      if (bandejaGrupo && p.grupo_id !== bandejaGrupo) return false;
      return true;
    });
  }, [planesBandejaJefe, bandejaEstado, bandejaGrupo]);

  const BANDEJA_PAGE_SIZE = 10;
  const totalPaginasBandeja = Math.max(1, Math.ceil(planesBandejaFiltrados.length / BANDEJA_PAGE_SIZE));
  const planesBandejaPagina = useMemo(() => {
    const p = Math.min(bandejaPage, totalPaginasBandeja);
    const start = (p - 1) * BANDEJA_PAGE_SIZE;
    return planesBandejaFiltrados.slice(start, start + BANDEJA_PAGE_SIZE);
  }, [planesBandejaFiltrados, bandejaPage, totalPaginasBandeja]);

  const resumenFuente = tab === "bandeja" ? planesBandejaFiltrados : planes;
  const resumenEstados = useMemo(() => {
    const r = { BORRADOR: 0, ENVIADO: 0, EN_REVISION: 0, HABILITADO: 0, CERRADO: 0 };
    for (const p of resumenFuente) if (r[p.estado] != null) r[p.estado]++;
    return r;
  }, [resumenFuente]);

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
              Flujo: Borrador → Enviado → Habilitado (aprobado por superior).
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
        <div className="mb-3 flex flex-wrap gap-2">
          {gruposDisponibles.map((g) => {
            const meta = resumenGrupoPeriodo[g.id] || { estado: "SIN_PLAN", cantidad: 0 };
            const activo = grupoId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGrupoId(g.id)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${estiloTarjetaGrupo(meta.estado, activo)}`}
              >
                <div className="font-semibold">{g.label}</div>
                <div className="mt-0.5 text-[11px] opacity-85">
                  <span className="mr-1">{iconoEstadoGrupo(meta.estado)}</span>
                  {periodo} — {LABEL_ESTADO[meta.estado] || "Sin plan"}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Grupo seleccionado</label>
            <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
              {grupoLabel || (gruposCargando ? "Cargando grupos…" : "Seleccionar grupo…")}
            </div>
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {periodosPermitidos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
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
              <option value="EN_REVISION">En revisión</option>
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
                          <p className="text-sm font-medium text-slate-800">{tituloPlan(plan, grupoLabel)}</p>
                          <p className="font-mono text-[11px] text-slate-400">{plan.id}</p>
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
                          <BadgeEstadoPlan estado={plan.estado} />
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
                            {(plan.estado === "BORRADOR" || plan.estado === "EN_REVISION") && (
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
        <>
          <Card className="px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-52">
                <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
                <select
                  value={bandejaEstado}
                  onChange={(e) => {
                    setBandejaEstado(e.target.value);
                    setBandejaPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Todos</option>
                  <option value="ENVIADO">Pendiente (Enviado)</option>
                  <option value="EN_REVISION">En revisión</option>
                  <option value="BORRADOR">Devuelto (Borrador)</option>
                  <option value="HABILITADO">Aprobado/Habilitado</option>
                  <option value="CERRADO">Cerrado</option>
                </select>
              </div>
              <div className="w-full sm:flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Grupo</label>
                <select
                  value={bandejaGrupo}
                  onChange={(e) => {
                    setBandejaGrupo(e.target.value);
                    setBandejaPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Todos los grupos</option>
                  {gruposBandeja.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={cargarBandejaAprobaciones}
                disabled={bandejaLoading}
                className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {bandejaLoading ? "Cargando…" : "Recargar bandeja"}
              </button>
            </div>
          </Card>

          {planes.some((p) => p.estado === "ENVIADO" && p.creado_por_persona_id === personaId) && planesBandejaFiltrados.length === 0 && (
            <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Tenés plan(es) enviado(s) en este grupo. Si el servicio no tiene superior jerárquico, no aparecen acá:
              RRHH los revisa en su bandeja.
            </div>
          )}
          {bandejaLoading ? (
            <Card className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">Cargando bandeja de aprobaciones…</p>
            </Card>
          ) : (
            <>
              <BandejaAprobaciones
                planes={planesBandejaPagina}
                onTransicion={handleTransicion}
                operando={operando}
                esRrhh={esRrhh}
              />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                <span>
                  Página {Math.min(bandejaPage, totalPaginasBandeja)} de {totalPaginasBandeja} · {planesBandejaFiltrados.length} resultado(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={bandejaPage <= 1}
                    onClick={() => setBandejaPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={bandejaPage >= totalPaginasBandeja}
                    onClick={() => setBandejaPage((p) => Math.min(totalPaginasBandeja, p + 1))}
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal Grilla Mensual / Plan Perpetuo */}
      {planEdicion && planEdicion.tipo_plan === "mensual" && (
        <GrillaMensualEditor
          plan={planEdicion.nuevo ? null : planEdicion}
          grupoId={grupoId}
          grupoLabel={grupoLabel}
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
          grupoLabel={grupoLabel}
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
              <p><span className="font-medium">Estado:</span> <BadgeEstadoPlan estado={planDetalle.estado} /></p>
              <p><span className="font-medium">Grupo:</span> {planDetalle.grupo_label || grupoLabel || planDetalle.grupo_id}</p>
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
