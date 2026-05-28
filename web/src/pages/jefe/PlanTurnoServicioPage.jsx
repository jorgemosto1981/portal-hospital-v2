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
import { claimsIncludeJefe, claimsIncludeRrhh } from "../../features/routing/portalRole.js";
import GrillaMensualEditor from "./planes/GrillaMensualEditor.jsx";
import PlanPerpetualViewer from "./planes/PlanPerpetualViewer.jsx";
import BadgeEstadoPlan, { LABEL_ESTADO } from "../../components/ui/BadgeEstadoPlan.jsx";
import { periodosVentanaJefe } from "../../features/jefe/periodoJefe.js";

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

function estiloTarjetaMisTurnos(estado, activo, esHistorico) {
  const baseActivo = activo ? "ring-2 ring-offset-1" : "";
  if (esHistorico) {
    return activo
      ? `border-slate-300 bg-slate-100 text-slate-800 ring-slate-300 ${baseActivo}`
      : "border-slate-200 bg-slate-100/80 text-slate-700 hover:border-slate-300";
  }
  if (estado === "SIN_PLAN") {
    return activo
      ? `border-rose-300 bg-rose-50 text-rose-900 ring-rose-300 ${baseActivo}`
      : "border-rose-200 bg-rose-50/80 text-rose-900 hover:border-rose-300";
  }
  if (estado === "HABILITADO") {
    return activo
      ? `border-emerald-300 bg-emerald-50 text-emerald-900 ring-emerald-300 ${baseActivo}`
      : "border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:border-emerald-300";
  }
  return activo
    ? `border-amber-300 bg-amber-50 text-amber-900 ring-amber-300 ${baseActivo}`
    : "border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300";
}

function etiquetaEstadoTarjeta(estado, esHistorico = false) {
  if (estado === "SIN_PLAN") return esHistorico ? "Sin Turno" : "Crear Turno";
  return LABEL_ESTADO[estado] || estado;
}

function etiquetaGrupo(row) {
  return String(row.nombre || row.codigo || row.titulo || "").trim() || String(row.id || row.grupo_de_trabajo_id || "");
}

function fechaCorteFinMes(periodo) {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!Number.isFinite(anio) || !Number.isFinite(mes)) return "";
  const d = new Date(anio, mes, 0);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelPeriodoCard(periodo, idx) {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  const fecha = new Date(anio, (mes || 1) - 1, 1);
  const mesTxt = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const pref = idx === 0 ? "Mes anterior" : idx === 1 ? "Mes actual" : "Mes siguiente";
  return `${pref} · ${mesTxt}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("es-AR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    if (typeof value === "object" && value._seconds) {
      const d = new Date(Number(value._seconds) * 1000);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("es-AR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
  } catch {
    // no-op
  }
  return String(value);
}

function labelAgentePlan(ag) {
  return (
    String(ag?.persona_label || "").trim() ||
    String(ag?.persona_nombre || "").trim() ||
    String(ag?.label || "").trim() ||
    String(ag?.persona_id || "—")
  );
}

function labelActorHistorial(h) {
  const label =
    String(h?.actor_label || "").trim() ||
    String(h?.actor_nombre || "").trim() ||
    String(h?.actor_persona_label || "").trim();
  if (label) return label;
  const rol = String(h?.rol || "").toLowerCase();
  if (rol.includes("rrhh")) return "Usuario RRHH";
  if (rol.includes("jefe")) return "Usuario Jefatura";
  return "Usuario del sistema";
}

export default function PlanTurnoServicioPage() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const esJefe = claimsIncludeJefe(claims);
  const tieneGruposHijos = claims?.tiene_subordinados === true;
  const mostrarAprobacionTurnos = esRrhh || (esJefe && tieneGruposHijos);
  const personaId = String(claims?.persona_id || "").trim();

  const [grupoId, setGrupoId] = useState("");
  const [periodo, setPeriodo] = useState(periodosVentanaJefe()[1]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [planEdicion, setPlanEdicion] = useState(null);
  const [planDetalle, setPlanDetalle] = useState(null);
  const [planOpciones, setPlanOpciones] = useState(null);
  const [operando, setOperando] = useState(false);
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposPorPeriodo, setGruposPorPeriodo] = useState({});
  const [gruposCargando, setGruposCargando] = useState(false);
  const [resumenGrupoPeriodo, setResumenGrupoPeriodo] = useState({});
  const periodosPermitidos = useMemo(() => periodosVentanaJefe(), []);

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
          const list = activos.map((r) => ({
            id: r.id,
            label: etiquetaGrupo(r),
          }));
          setGruposDisponibles(list);
          const byPeriodo = Object.fromEntries(
            periodosPermitidos.map((p) => [p, list]),
          );
          setGruposPorPeriodo(byPeriodo);
        } else {
          if (cancelled) return;
          const byPeriodo = {};
          const unionMap = new Map();
          for (const p of periodosPermitidos) {
            const res = await callResolverContextoLaboralSolicitud({
              persona_id: personaId,
              fecha_desde: fechaCorteFinMes(p),
            });
            const raw = Array.isArray(res?.data?.grupos_trabajo_vigentes)
              ? res.data.grupos_trabajo_vigentes
              : [];
            const mapped = raw.map((g) => ({
              id: g.grupo_de_trabajo_id,
              label: g.etiqueta_ui || g.grupo_de_trabajo_id,
            }));
            byPeriodo[p] = mapped;
            mapped.forEach((g) => {
              if (!unionMap.has(g.id)) unionMap.set(g.id, g);
            });
          }
          setGruposPorPeriodo(byPeriodo);
          setGruposDisponibles([...unionMap.values()]);
        }
      } catch {
        // silencioso: el select queda vacío
      } finally {
        if (!cancelled) setGruposCargando(false);
      }
    })();

    return () => { cancelled = true; };
  }, [personaId, esRrhh, periodosPermitidos]);

  const cargar = useCallback(async () => {
    if (!grupoId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await callListarPlanesTurnoServicio({
        grupo_id: grupoId.trim(),
        periodo: periodo || undefined,
      });
      setPlanes(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar planes.");
    } finally {
      setLoading(false);
    }
  }, [grupoId, periodo]);

  useEffect(() => {
    if (!periodosPermitidos.length) {
      setResumenGrupoPeriodo({});
      return;
    }
    let cancel = false;
    (async () => {
      const resumen = {};
      for (const p of periodosPermitidos) {
        const gruposObjetivo = (gruposPorPeriodo[p] || []).slice(0, 30);
        const resultados = await Promise.all(
          gruposObjetivo.map(async (g) => {
            try {
              const res = await callListarPlanesTurnoServicio({
                grupo_id: g.id,
                periodo: p,
              });
              const items = res?.data?.items || [];
              return [g.id, { estado: estadoPrincipalGrupo(items), cantidad: items.length, items }];
            } catch {
              return [g.id, { estado: "SIN_PLAN", cantidad: 0, items: [] }];
            }
          }),
        );
        resumen[p] = Object.fromEntries(resultados);
      }
      if (cancel) return;
      setResumenGrupoPeriodo(resumen);
    })();
    return () => {
      cancel = true;
    };
  }, [periodosPermitidos, gruposPorPeriodo]);

  useEffect(() => {
    if (grupoId.trim()) cargar();
  }, [cargar, grupoId]);

  useEffect(() => {
    const gruposMesActual = gruposPorPeriodo[periodo] || [];
    if (!gruposMesActual.length) return;
    if (grupoId && gruposMesActual.some((g) => g.id === grupoId)) return;
    setGrupoId(gruposMesActual[0].id);
  }, [periodo, gruposPorPeriodo, grupoId]);

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

  const estadosInbox = new Set(["ENVIADO", "EN_REVISION"]);

  const seleccionarTarjetaPlan = useCallback(
    async (p, g, esHistorico = false) => {
      setPeriodo(p);
      setGrupoId(g.id);
      let meta = resumenGrupoPeriodo[p]?.[g.id];
      let items = Array.isArray(meta?.items) ? meta.items : [];
      if (!meta || items.length === 0) {
        try {
          const res = await callListarPlanesTurnoServicio({
            grupo_id: g.id,
            periodo: p,
          });
          items = res?.data?.items || [];
          meta = { estado: estadoPrincipalGrupo(items), cantidad: items.length, items };
        } catch {
          items = [];
          meta = { estado: "SIN_PLAN", cantidad: 0, items: [] };
        }
      }

      if (esHistorico && (meta.estado === "SIN_PLAN" || items.length === 0)) {
        showFeedback("Mes anterior en modo histórico: no se pueden crear planes.");
        return;
      }

      if (meta.estado === "SIN_PLAN" || items.length === 0) {
        setPlanEdicion({ nuevo: true, tipo_plan: "mensual" });
        return;
      }

      const plan = items[0];
      if (esHistorico) {
        setPlanDetalle(plan);
        return;
      }
      if (meta.estado === "HABILITADO") {
        setPlanDetalle(plan);
        return;
      }
      setPlanOpciones({ plan, estado: meta.estado, grupoLabel: g.label, periodo: p });
    },
    [resumenGrupoPeriodo],
  );

  if (!esJefe && !esRrhh) {
    return (
      <Card className="px-4 py-6">
        <p className="text-sm text-slate-700">Sin permisos de jefatura para esta sección.</p>
      </Card>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Turnos Mensuales
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Gestión de la capa teórica mensual y circuito de aprobación superior: creación, visualización y trazabilidad histórica por grupo y período.
            </p>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <Card className="px-4 py-3">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Mis turnos mensuales</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {periodosPermitidos.map((p, idx) => (
            <section key={p} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {idx === 0 ? "Mes anterior" : idx === 1 ? "Mes actual" : "Mes siguiente"}
              </p>
              <p className="text-sm font-medium text-slate-900">{labelPeriodoCard(p, idx).split(" · ")[1]}</p>
              <div className="mt-2 space-y-2">
                {(gruposPorPeriodo[p] || []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                    Sin grupos disponibles.
                  </p>
                ) : (
                  (gruposPorPeriodo[p] || []).map((g) => {
                    const meta = resumenGrupoPeriodo[p]?.[g.id] || { estado: "SIN_PLAN", cantidad: 0 };
                    const activo = grupoId === g.id && periodo === p;
                    const esHistorico = idx === 0;
                    return (
                      <button
                        key={`${p}-${g.id}`}
                        type="button"
                        onClick={() => void seleccionarTarjetaPlan(p, g, esHistorico)}
                        className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${estiloTarjetaMisTurnos(meta.estado, activo, esHistorico)}`}
                      >
                        <span className="font-medium">{g.label}</span>
                        <span className="text-xs opacity-85">
                          {iconoEstadoGrupo(meta.estado)} {etiquetaEstadoTarjeta(meta.estado, esHistorico)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      </Card>

      {mostrarAprobacionTurnos ? (
        <Card className="px-4 py-3">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Aprobación de Turnos Mensuales</h2>
          <p className="mb-3 text-xs text-slate-600">Bandeja tipo inbox para planes enviados/en revisión de grupos hijos.</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {periodosPermitidos.map((p, idx) => (
              <section key={`inbox-${p}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {idx === 0 ? "Mes anterior" : idx === 1 ? "Mes actual" : "Mes siguiente"}
                </p>
                <p className="text-sm font-medium text-slate-900">{labelPeriodoCard(p, idx).split(" · ")[1]}</p>
                <div className="mt-2 space-y-2">
                  {(gruposPorPeriodo[p] || [])
                    .filter((g) => estadosInbox.has(resumenGrupoPeriodo[p]?.[g.id]?.estado || ""))
                    .map((g) => {
                      const meta = resumenGrupoPeriodo[p]?.[g.id] || { estado: "SIN_PLAN", cantidad: 0 };
                      const activo = grupoId === g.id && periodo === p;
                      return (
                        <button
                          key={`inbox-${p}-${g.id}`}
                          type="button"
                          onClick={() => void seleccionarTarjetaPlan(p, g, idx === 0)}
                          className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${estiloTarjetaGrupo(meta.estado, activo)}`}
                        >
                          <span className="font-medium">{g.label}</span>
                          <span className="text-xs opacity-85">
                            {iconoEstadoGrupo(meta.estado)} {LABEL_ESTADO[meta.estado] || meta.estado}
                          </span>
                        </button>
                      );
                    })}
                  {(gruposPorPeriodo[p] || []).filter((g) => estadosInbox.has(resumenGrupoPeriodo[p]?.[g.id]?.estado || "")).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                      Sin pendientes de aprobación.
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </Card>
      ) : null}

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
      {loading ? (
        <Card className="px-4 py-5 text-center">
          <p className="text-sm text-slate-500">Cargando planes...</p>
        </Card>
      ) : null}

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

      {planOpciones && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPlanOpciones(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">Opciones del plan</h3>
            <p className="mt-1 text-xs text-slate-600">
              {planOpciones.grupoLabel} · {planOpciones.periodo} · {LABEL_ESTADO[planOpciones.estado] || planOpciones.estado}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setPlanDetalle(planOpciones.plan); setPlanOpciones(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Ver
              </button>
              {(planOpciones.plan.estado === "BORRADOR" || planOpciones.plan.estado === "EN_REVISION") && (
                <button type="button" onClick={() => { setPlanEdicion(planOpciones.plan); setPlanOpciones(null); }} className="rounded-lg border border-indigo-300 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">
                  Editar
                </button>
              )}
              {planOpciones.plan.estado === "BORRADOR" && (
                <button type="button" disabled={operando} onClick={() => { void handleTransicion("enviar", planOpciones.plan.id); setPlanOpciones(null); }} className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                  Enviar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle read-only */}
      {planDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={() => setPlanDetalle(null)}>
          <div className="relative flex h-[96vh] w-[98vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="px-6 pt-6 text-lg font-semibold text-slate-900">
                Detalle del plan <span className="font-mono text-sm text-slate-500">{planDetalle.id}</span>
              </h2>
              <button onClick={() => setPlanDetalle(null)} className="mr-6 mt-6 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-6 pb-6 text-sm text-slate-700">
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
                  <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
                    <table className="min-w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="h-9 min-w-[14rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold text-slate-700">Agente</th>
                          {planDetalle.agentes[0]?.dias && Object.keys(planDetalle.agentes[0].dias).sort().map((d) => (
                            <th key={d} className="h-9 border border-slate-300 bg-slate-100 px-1 py-1 text-center font-semibold text-slate-600">{d.slice(-2)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-slate-300">
                        {planDetalle.agentes.map((ag) => (
                          <tr key={ag.persona_id}>
                            <td className="whitespace-nowrap border border-slate-300 bg-white px-2 py-2 font-medium text-slate-800">{labelAgentePlan(ag)}</td>
                            {ag.dias && Object.keys(ag.dias).sort().map((d) => {
                              const cel = ag.dias[d];
                              const esFranco = cel.tipo_dia === "franco" || cel.tipo_dia === "no_laborable";
                              const color = esFranco ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-700";
                              return (
                                <td key={d} className={`h-9 border border-slate-300 px-1 py-1 text-center font-medium ${color}`}>
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
                  <details className="rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">
                      Historial de aprobaciones
                    </summary>
                    <div className="space-y-1 px-3 pb-3">
                      {planDetalle.historial_aprobaciones.map((h, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                          <span className="font-medium capitalize">{h.accion || "—"}</span>
                          <span className="text-slate-400">por</span>
                          <span>{labelActorHistorial(h)}</span>
                          <span className="text-slate-400">({h.rol || "—"})</span>
                          <span className="ml-auto text-slate-500">
                            {formatDateTime(h.fecha || h.fecha_hora || h.created_at || h.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
