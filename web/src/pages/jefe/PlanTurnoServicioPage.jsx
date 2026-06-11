import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Card from "../../components/ui/Card.jsx";
import {
  callListarPlanesTurnoServicio,
  callListarContextoPlanGrupo,
  callGuardarPlanTurnoServicio,
  callIniciarIncorporacionPlanMensual,
  callEnviarPlanTurnoServicio,
  callAprobarPlanTurnoServicio,
  callRechazarPlanTurnoServicio,
  callCerrarPlanPerpetuo,
  callResolverContextoLaboralSolicitud,
} from "../../services/callables.js";
import {
  estadoResumenGrupo,
  estadoInboxGrupo,
  grupoTieneInboxPendiente,
  planPrincipalCanonico,
  planIncorporacionActivo,
  esPlanIncorporacion,
} from "../../features/planes/planRolUtils.js";
import PlanGrillaAprobadaTable from "../../features/planes/PlanGrillaAprobadaTable.jsx";
import { useVistaPlanTurno } from "../../features/planes/useVistaPlanTurno.js";
import {
  listarGruposTrabajoCatalogo,
  peekGruposTrabajoCatalogo,
} from "../../features/catalogo/listarGruposTrabajoCatalogo.js";
import { useAuthClaims } from "../../features/auth/useAuthClaims.js";
import { useAuthSession } from "../../features/auth/useAuthSession.js";
import { claimsIncludeJefe } from "../../features/routing/portalRole.js";
import {
  actorPortalTeoriaDesdePlanes,
  cargaCatalogoGruposPlanes,
  PLANES_TURNO_SHELL,
  resolvePlanesTurnoCapabilities,
  shellEsPlanesRrhh,
} from "../../features/planes/planesTurnoCapabilities.js";
import GrillaMensualEditor from "./planes/GrillaMensualEditor.jsx";
import {
  contarHuecosEnPlanMensual,
  tooltipBloqueoHuecosPlan,
} from "./planes/planHuecosTurnoUtils.js";
import { guardarPlanMensualDatosSchema } from "../../schemas/planTurnoServicio.schema.js";
import PlanPerpetualViewer from "./planes/PlanPerpetualViewer.jsx";
import BadgeEstadoPlan, { LABEL_ESTADO } from "../../components/ui/BadgeEstadoPlan.jsx";
import { periodosVentanaJefe } from "../../features/jefe/periodoJefe.js";
import {
  actorTeoriaDesdePortal,
  copyMotivoRechazoTeoriaUsuario,
  evaluarPermisosPlanMensual,
} from "../../features/grilla/teoriaPermisosGso.js";
import SelectorFocoGdt from "../../features/grilla/SelectorFocoGdt.jsx";
import { usePlanTurnoFocoUrl } from "../../features/planes/usePlanTurnoFocoUrl.js";
import {
  esHorizonteCierre,
  HORIZONTE_CONSOLA_TITULOS,
  indiceHorizonteEnVentana,
  resolverIntencionTarjetaConsola,
} from "../../features/planes/planRefinamientoConsolaUtils.js";
import ConsolaTripleHorizonteSeccion from "../../features/planes/ConsolaTripleHorizonteSeccion.jsx";
import { useGuardrailOutboxAlCambiarFoco } from "../../features/planes/useGuardrailOutboxAlCambiarFoco.js";
import { useAsistenciaOutbox } from "../../features/grilla/useAsistenciaOutbox.js";

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

function estiloTarjetaMisTurnos(estado, activo, esHistorico, verEquipoSinPlan = false, borradorRechazado = false) {
  const baseActivo = activo ? "ring-2 ring-offset-1" : "";
  if (esHistorico && !borradorRechazado) {
    return activo
      ? `border-slate-300 bg-slate-100 text-slate-800 ring-slate-300 ${baseActivo}`
      : "border-slate-200 bg-slate-100/80 text-slate-700 hover:border-slate-300";
  }
  if (estado === "SIN_PLAN") {
    if (verEquipoSinPlan) {
      return activo
        ? `border-slate-300 bg-slate-50 text-slate-800 ring-slate-300 ${baseActivo}`
        : "border-slate-200 bg-slate-50/90 text-slate-700 hover:border-slate-300";
    }
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

function etiquetaEstadoTarjeta(estado, esHistorico = false, hayPlanificados, borradorRechazado = false) {
  if (estado === "SIN_PLAN") {
    if (esHistorico) return "Sin Turno";
    if (hayPlanificados === false) return "Ver equipo";
    return "Crear Turno";
  }
  if (borradorRechazado) return "Corregir rechazo";
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

/** Mes anterior: excepción para corregir y reenviar tras rechazo RRHH. */
function esBorradorRechazado(plan) {
  if (!plan || String(plan.estado || "") !== "BORRADOR") return false;
  if (esPlanIncorporacion(plan)) return false;
  return Boolean(String(plan.observaciones_rechazo || "").trim());
}

function borradorRechazadoEnItems(items) {
  return esBorradorRechazado(planPrincipalCanonico(items));
}

function labelPeriodoCard(periodo, idx) {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  const fecha = new Date(anio, (mes || 1) - 1, 1);
  const mesTxt = fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const etiquetaHorizonte = HORIZONTE_CONSOLA_TITULOS[idx] ?? HORIZONTE_CONSOLA_TITULOS[1];
  const rol = etiquetaHorizonte.split(" · ")[0] || etiquetaHorizonte;
  return `${rol} · ${mesTxt}`;
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

/**
 * @param {{ capabilities?: import("../../features/planes/planesTurnoCapabilities.js").PlanesTurnoCapabilities }} props
 */
export default function PlanTurnoServicioPage({
  capabilities: capabilitiesProp,
}) {
  const capabilities =
    capabilitiesProp ?? resolvePlanesTurnoCapabilities(PLANES_TURNO_SHELL.JEFE);
  const [searchParams] = useSearchParams();
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esJefe = claimsIncludeJefe(claims);
  const tieneGruposHijos = claims?.tiene_subordinados === true;
  const mostrarAprobacionTurnos =
    capabilities.puedeVerBandejaAprobacionMasiva
    || (capabilities.shell === PLANES_TURNO_SHELL.JEFE && esJefe && tieneGruposHijos);
  const personaId = String(claims?.persona_id || "").trim();
  const cargaCatalogo = cargaCatalogoGruposPlanes(capabilities);

  const periodosPermitidosInicial = useMemo(() => periodosVentanaJefe(), []);
  const periodoDesdeUrl = String(searchParams.get("periodo") || "").trim();
  const grupoDesdeUrl = String(searchParams.get("grupo_id") || "").trim();
  const grupoInicialUrl = /^gdt_/i.test(grupoDesdeUrl) ? grupoDesdeUrl : "";
  const [grupoId, setGrupoId] = useState(() => grupoInicialUrl);
  const [periodo, setPeriodo] = useState(() =>
    periodoDesdeUrl && periodosPermitidosInicial.includes(periodoDesdeUrl)
      ? periodoDesdeUrl
      : periodosPermitidosInicial[1],
  );
  const [resumenHabilitado, setResumenHabilitado] = useState(() => Boolean(grupoInicialUrl));
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
  const periodosPermitidos = periodosPermitidosInicial;

  const actorTeoriaPlan = useMemo(
    () =>
      actorTeoriaDesdePortal(
        actorPortalTeoriaDesdePlanes(capabilities, { personaId, esJefe }),
      ),
    [capabilities, personaId, esJefe],
  );

  const permisosPlan = useCallback(
    (planEstado) => evaluarPermisosPlanMensual(actorTeoriaPlan, planEstado),
    [actorTeoriaPlan],
  );

  const abrirPlanDetalle = useCallback((plan) => {
    setPlanDetalle(plan);
  }, []);

  const {
    loading: planDetalleGrillaLoading,
    grillaAprobada: planDetalleGrilla,
    labelsPorPersona: planDetalleGrillaLabels,
  } = useVistaPlanTurno(
    planDetalle?.tipo_plan === "mensual" ? planDetalle.id : null,
    Boolean(planDetalle?.tipo_plan === "mensual"),
  );

  useEffect(() => {
    if (!personaId) return;
    let cancelled = false;

    const aplicarCatalogoGrupos = (rows) => {
      const activos = rows.filter((r) => r.activo !== false);
      activos.sort((a, b) => etiquetaGrupo(a).localeCompare(etiquetaGrupo(b), "es"));
      const list = activos.map((r) => ({
        id: r.id,
        label: etiquetaGrupo(r),
      }));
      setGruposDisponibles(list);
      const byPeriodo = Object.fromEntries(periodosPermitidos.map((p) => [p, list]));
      setGruposPorPeriodo(byPeriodo);
    };

    if (cargaCatalogo) {
      const warm = peekGruposTrabajoCatalogo(400);
      if (warm) {
        aplicarCatalogoGrupos(warm);
        setGruposCargando(false);
        return () => {
          cancelled = true;
        };
      }
    }

    setGruposCargando(true);

    (async () => {
      try {
        if (cargaCatalogo) {
          const rows = await listarGruposTrabajoCatalogo({ limit: 400 });
          if (cancelled) return;
          aplicarCatalogoGrupos(rows);
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
  }, [personaId, cargaCatalogo, periodosPermitidos]);

  const cargar = useCallback(async (override) => {
    const gid = String(override?.grupoId ?? grupoId).trim();
    const per = override?.periodo ?? periodo;
    if (!gid) return;
    setLoading(true);
    setError("");
    try {
      const res = await callListarPlanesTurnoServicio({
        grupo_id: gid,
        periodo: per || undefined,
      });
      setPlanes(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar planes.");
    } finally {
      setLoading(false);
    }
  }, [grupoId, periodo]);

  const cargarResumenGrupos = useCallback(async () => {
    if (!periodosPermitidos.length) {
      setResumenGrupoPeriodo({});
      return;
    }
    const resumen = {};
    for (const p of periodosPermitidos) {
      const gruposObjetivo = (gruposPorPeriodo[p] || []).slice(0, 30);
      const resultados = await Promise.all(
        gruposObjetivo.map(async (g) => {
          try {
            const [resPlanes, resCtx] = await Promise.all([
              callListarPlanesTurnoServicio({ grupo_id: g.id, periodo: p }),
              callListarContextoPlanGrupo({ grupo_id: g.id, periodo: p }),
            ]);
            const items = resPlanes?.data?.items || [];
            return [
              g.id,
              {
                estado: estadoResumenGrupo(items),
                cantidad: items.length,
                items,
                hay_planificados: resCtx?.data?.hay_agentes_planificados === true,
                requiere_plan_individual: resCtx?.data?.requiere_plan_individual === true,
                agentes_nuevos: resCtx?.data?.agentes_nuevos || [],
              },
            ];
          } catch {
            return [g.id, { estado: "SIN_PLAN", cantidad: 0, items: [], hay_planificados: false }];
          }
        }),
      );
      resumen[p] = Object.fromEntries(resultados);
    }
    setResumenGrupoPeriodo(resumen);
  }, [periodosPermitidos, gruposPorPeriodo]);

  const resolverGrupoLabel = useCallback(
    (id) => {
      const g = gruposDisponibles.find((x) => x.id === id);
      return g?.label || id;
    },
    [gruposDisponibles],
  );

  const onFocoListoParaCarga = useCallback(({ grupoId: gid, periodo: per }) => {
    setGrupoId(gid);
    setPeriodo(per);
    setResumenHabilitado(true);
  }, []);

  const focoUrl = usePlanTurnoFocoUrl({
    periodoPorDefecto: periodosPermitidosInicial[1],
    periodosPermitidos,
    listaGruposCargando: gruposCargando,
    resolverGrupoLabel,
    onFocoListoParaCarga,
  });

  const gruposCatalogoFoco = useMemo(
    () =>
      gruposDisponibles.map((g) => ({
        id: g.id,
        nombre: g.label,
      })),
    [gruposDisponibles],
  );

  const gruposHlgFoco = useMemo(
    () =>
      (gruposPorPeriodo[focoUrl.periodoUrl] || []).map((g) => ({
        grupo_de_trabajo_id: g.id,
        etiqueta_ui: g.label,
      })),
    [gruposPorPeriodo, focoUrl.periodoUrl],
  );

  const consolaPanoramaJefe =
    capabilities.consolaTripleHorizonteEnFrio && !focoUrl.tieneFocoValido;

  const [consolaColAbierta, setConsolaColAbierta] = useState({
    0: false,
    1: true,
    2: false,
  });
  const toggleConsolaCol = useCallback((idx) => {
    setConsolaColAbierta((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const periodoOutboxLectura = focoUrl.tieneFocoValido ? periodo : periodosPermitidos[1];
  const outboxPlanes = useAsistenciaOutbox({
    editorPersonaId: personaId,
    periodo: periodoOutboxLectura,
  });
  const { intentarNavegacionFoco } = useGuardrailOutboxAlCambiarFoco({
    ops: outboxPlanes.ops,
    clearOutbox: outboxPlanes.clear,
    focoOrigenExplicito: {
      grupoId: focoUrl.tieneFocoValido ? grupoId || focoUrl.grupoIdUrl : "",
      periodo: focoUrl.tieneFocoValido ? periodo : "",
    },
  });

  useEffect(() => {
    if (esJefe) setResumenHabilitado(true);
  }, [esJefe]);

  useEffect(() => {
    if (!resumenHabilitado || !grupoId.trim()) return;
    void cargar();
  }, [resumenHabilitado, grupoId, periodo, cargar]);

  useEffect(() => {
    if (!resumenHabilitado) return;
    let cancel = false;
    (async () => {
      await cargarResumenGrupos();
      if (cancel) return;
    })();
    return () => {
      cancel = true;
    };
  }, [cargarResumenGrupos, resumenHabilitado]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4000);
  };

  const handleGuardarBorrador = useCallback(async (datos, existingId, opciones = {}) => {
    const estadoRef =
      planEdicion?.estado
      || planes.find((p) => p.id === existingId)?.estado
      || "BORRADOR";
    const { guardar: permGuardar } = permisosPlan(estadoRef);
    if (!permGuardar.permitido) {
      const msg = copyMotivoRechazoTeoriaUsuario(permGuardar.motivoRechazo);
      setError(msg);
      return { ok: false, error: msg };
    }
    setOperando(true);
    setError("");
    try {
      const parsed = guardarPlanMensualDatosSchema.safeParse(datos);
      if (!parsed.success) {
        const msg =
          parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") ||
          "Datos del plan inválidos.";
        setError(msg);
        return { ok: false, error: msg };
      }
      const res = await callGuardarPlanTurnoServicio({
        datos: parsed.data,
        id: existingId || undefined,
      });
      showFeedback(`Borrador guardado (${res.data?.id}).`);
      setPlanEdicion(null);
      await cargar();
      await cargarResumenGrupos();
      return {
        ok: true,
        id: res.data?.id,
        plan_version_token: res.data?.plan_version_token || null,
      };
    } catch (e) {
      const msg = e?.message || "Error al guardar.";
      const visible = msg.includes("PLT-") ? msg : `Error al guardar. ${msg}`;
      setError(visible);
      return { ok: false, error: visible };
    } finally {
      setOperando(false);
    }
  }, [cargar, cargarResumenGrupos, permisosPlan, planEdicion, planes]);

  const handleTransicion = useCallback(async (accion, planId, extras) => {
    setOperando(true);
    try {
      let res;
      const planRef = planes.find((p) => p.id === planId);
      if (accion === "enviar") {
        const { enviar: permEnviar } = permisosPlan(planRef?.estado);
        if (!permEnviar.permitido) {
          const msg = copyMotivoRechazoTeoriaUsuario(permEnviar.motivoRechazo);
          setError(msg);
          showFeedback("Envío no permitido.");
          return;
        }
      }
      const huecosPersistidos =
        planRef?.tipo_plan === "mensual" ? contarHuecosEnPlanMensual(planRef) : 0;
      if (
        (accion === "enviar" || accion === "aprobar") &&
        huecosPersistidos > 0
      ) {
        setError(tooltipBloqueoHuecosPlan(huecosPersistidos));
        showFeedback("Acción bloqueada: corregí los huecos de turno en el editor del plan.");
        return;
      }
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
          if (res.data?.estado === "MERGEADO") {
            showFeedback("Incorporación aprobada y mergeada al plan operativo.");
          } else if (res.data?.warnings?.length) {
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
      setPlanOpciones(null);
      await cargar();
      await cargarResumenGrupos();
    } catch (e) {
      setError(e?.message || `Error en acción ${accion}.`);
    } finally {
      setOperando(false);
    }
  }, [cargar, cargarResumenGrupos, permisosPlan, planes]);

  const grupoLabel = useMemo(() => {
    const g = gruposDisponibles.find((x) => x.id === grupoId);
    return g?.label || grupoId;
  }, [gruposDisponibles, grupoId]);

  const planPrincipalMes = useMemo(() => planPrincipalCanonico(planes), [planes]);
  const planIncorporacionMes = useMemo(() => planIncorporacionActivo(planes), [planes]);
  const planOpcionesResuelto = useMemo(() => {
    if (!planOpciones?.plan) return null;
    const id = planOpciones.plan.id;
    if (!id) return planOpciones.plan;
    return planes.find((p) => p.id === id) ?? planOpciones.plan;
  }, [planOpciones, planes]);
  const huecosPlanPrincipal = useMemo(
    () => contarHuecosEnPlanMensual(planPrincipalMes),
    [planPrincipalMes],
  );
  const huecosPlanIncorporacion = useMemo(
    () => contarHuecosEnPlanMensual(planIncorporacionMes),
    [planIncorporacionMes],
  );
  const huecosPlanOpciones = useMemo(
    () => contarHuecosEnPlanMensual(planOpcionesResuelto),
    [planOpcionesResuelto],
  );
  const permisosPlanEdicion = useMemo(() => {
    if (!planEdicion || planEdicion.modoVistaEquipo || planEdicion.tipo_plan !== "mensual") {
      return null;
    }
    const estado = planEdicion.estado || "BORRADOR";
    return permisosPlan(estado);
  }, [planEdicion, permisosPlan]);

  const abrirEditorIncorporacion = useCallback(
    (planInc, agentesNuevos = []) => {
      if (!planInc) return;
      const desdeResumen = resumenGrupoPeriodo[periodo]?.[grupoId]?.agentes_nuevos || [];
      const desdePlan = (planInc.agentes || []).map((a) => ({
        persona_id: a.persona_id,
        persona_label: a.persona_label || a.nombre || a.persona_nombre,
        persona_dni: a.persona_dni || a.dni,
      }));
      setPlanEdicion({
        ...planInc,
        agentesNuevos: agentesNuevos.length
          ? agentesNuevos
          : desdeResumen.length
            ? desdeResumen
            : desdePlan,
      });
    },
    [grupoId, periodo, resumenGrupoPeriodo],
  );

  const handleIniciarIncorporacion = useCallback(async () => {
    const padre = planPrincipalMes;
    if (!padre?.id || padre.estado !== "HABILITADO") {
      setError("Solo podés iniciar incorporación sobre un plan operativo habilitado.");
      return;
    }
    if (planIncorporacionMes) {
      abrirEditorIncorporacion(planIncorporacionMes);
      return;
    }
    setOperando(true);
    setError("");
    try {
      const res = await callIniciarIncorporacionPlanMensual({ plan_padre_id: padre.id });
      const data = res.data || {};
      const listRes = await callListarPlanesTurnoServicio({
        grupo_id: grupoId.trim(),
        periodo: periodo || undefined,
      });
      const items = listRes.data?.items || [];
      setPlanes(items);
      await cargarResumenGrupos();
      const fresh = planIncorporacionActivo(items) || {
        id: data.id,
        tipo_plan: "mensual",
        periodo,
        grupo_id: grupoId,
        estado: data.estado || "BORRADOR",
        plan_rol: data.plan_rol || "incorporacion",
        plan_padre_id: data.plan_padre_id,
        plan_version_token: data.plan_version_token,
        agentes: [],
      };
      abrirEditorIncorporacion(fresh, data.agentes_nuevos || []);
      showFeedback(`Plan de incorporación creado (${data.id}).`);
    } catch (e) {
      const msg = e?.message || "No se pudo iniciar la incorporación.";
      setError(msg.includes("PLT-") ? msg : `Error al iniciar incorporación. ${msg}`);
    } finally {
      setOperando(false);
    }
  }, [
    planPrincipalMes,
    planIncorporacionMes,
    abrirEditorIncorporacion,
    cargar,
    cargarResumenGrupos,
    grupoId,
    periodo,
  ]);

  const seleccionarTarjetaPlan = useCallback(
    (p, g, esHistorico = false) => {
      intentarNavegacionFoco({ grupoId: g.id, periodo: p }, () => {
        void (async () => {
      focoUrl.pushFocoToUrl({ grupoId: g.id, periodo: p });
      setResumenHabilitado(true);
      setPeriodo(p);
      setGrupoId(g.id);

      const idxHorizonte = indiceHorizonteEnVentana(p, periodosPermitidos);
      const esHistoricoCol = esHistorico || esHorizonteCierre(idxHorizonte);

      let meta = resumenGrupoPeriodo[p]?.[g.id];
      let items = Array.isArray(meta?.items) ? meta.items : [];
      if (!meta || items.length === 0) {
        try {
          const res = await callListarPlanesTurnoServicio({
            grupo_id: g.id,
            periodo: p,
          });
          items = res?.data?.items || [];
          meta = {
            ...meta,
            estado: estadoResumenGrupo(items),
            cantidad: items.length,
            items,
          };
        } catch {
          items = [];
          meta = { estado: "SIN_PLAN", cantidad: 0, items: [] };
        }
      }

      const estadoResumen =
        items.length > 0 ? estadoResumenGrupo(items) : String(meta.estado || "SIN_PLAN");
      const cantidadItems = items.length;

      if (estadoResumen === "SIN_PLAN" || cantidadItems === 0) {
        let hayAgentesPlanificados = meta.hay_planificados;
        if (meta.hay_planificados !== true && meta.hay_planificados !== false) {
          try {
            const ctx = await callListarContextoPlanGrupo({ grupo_id: g.id, periodo: p });
            hayAgentesPlanificados = ctx?.data?.hay_agentes_planificados === true;
          } catch {
            hayAgentesPlanificados = false;
          }
        }

        const intencion = resolverIntencionTarjetaConsola({
          indiceHorizonte: idxHorizonte,
          estadoResumen: "SIN_PLAN",
          cantidadItems: 0,
          hayAgentesPlanificados,
          principalRechazado: false,
          incorporacionEditable: false,
          principalSoloLectura: false,
        });

        switch (intencion.kind) {
          case "FEEDBACK_HISTORICO_SIN_PLAN":
            showFeedback(
              intencion.mensajeFeedback ||
                "Mes anterior en modo histórico: no se pueden crear planes.",
            );
            return;
          case "ABRIR_VISTA_EQUIPO":
            setPlanEdicion({ modoVistaEquipo: true, tipo_plan: "mensual" });
            return;
          case "CREAR_PLAN_NUEVO":
            setPlanEdicion({ nuevo: true, tipo_plan: "mensual" });
            return;
          default:
            return;
        }
      }

      const principal = planPrincipalCanonico(items);
      const incorporacion = planIncorporacionActivo(items);
      if (!principal && !incorporacion) return;

      const principalRechazado = Boolean(principal && esBorradorRechazado(principal));
      const incorporacionEditable = Boolean(
        !esHistoricoCol &&
          incorporacion &&
          (incorporacion.estado === "BORRADOR" || incorporacion.estado === "EN_REVISION"),
      );
      const principalSoloLectura = Boolean(
        principal && (principal.estado === "HABILITADO" || principal.estado === "CERRADO"),
      );

      const intencion = resolverIntencionTarjetaConsola({
        indiceHorizonte: idxHorizonte,
        estadoResumen,
        cantidadItems,
        hayAgentesPlanificados: true,
        principalRechazado,
        incorporacionEditable,
        principalSoloLectura,
      });

      const plan = principal || incorporacion;

      switch (intencion.kind) {
        case "MODAL_OPCIONES_RECHAZADO_HISTORICO":
          if (principalRechazado && principal) {
            setPlanOpciones({
              plan: principal,
              estado: principal.estado,
              grupoLabel: g.label,
              periodo: p,
              mesHistoricoRechazado: true,
            });
          }
          return;
        case "VER_DETALLE_HISTORICO":
          if (principal) void abrirPlanDetalle(principal);
          return;
        case "EDITAR_INCORPORACION":
          if (incorporacion) {
            setPlanEdicion({
              ...incorporacion,
              agentesNuevos: meta.agentes_nuevos || [],
            });
          }
          return;
        case "VER_DETALLE":
          if (principal) void abrirPlanDetalle(principal);
          return;
        case "MODAL_OPCIONES_PLAN":
          if (plan) {
            setPlanOpciones({
              plan,
              estado: plan.estado,
              grupoLabel: g.label,
              periodo: p,
            });
          }
          return;
        default:
          return;
      }
        })();
      });
    },
    [
      resumenGrupoPeriodo,
      abrirPlanDetalle,
      focoUrl.pushFocoToUrl,
      periodosPermitidos,
      intentarNavegacionFoco,
    ],
  );

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

      <Card className="px-4 py-3">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Foco de trabajo</h2>
        <p className="mb-3 text-xs text-slate-600">
          {shellEsPlanesRrhh(capabilities)
            ? "Elegí sector y período. El foco queda en la URL al pulsá Ver."
            : consolaPanoramaJefe
              ? "Consola de tres meses abajo. Para aislar un sector, elegí grupo y período y pulsá Ver."
              : "Zoom en un sector. Usá Volver a consola para ver los tres horizontes."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1">
            <SelectorFocoGdt
              origenGrupos={
                capabilities.origenGrupos === "catalogo" ? "catalogo" : "hlg_vigente"
              }
              gruposCatalogo={gruposCatalogoFoco}
              gruposHlg={gruposHlgFoco}
              catalogoCargando={gruposCargando}
              hlgCargando={gruposCargando}
              grupoIdConfirmado={focoUrl.grupoIdUrl}
              periodoConfirmado={focoUrl.periodoUrl}
              periodoPorDefecto={periodosPermitidos[1]}
              disabled={loading}
              onConfirmarCarga={({ grupoId: gid, periodo: per }) => {
                intentarNavegacionFoco({ grupoId: gid, periodo: per }, () => {
                  focoUrl.pushFocoToUrl({ grupoId: gid, periodo: per });
                });
              }}
            />
          </div>
          {capabilities.muestraBotonVolverConsola && focoUrl.tieneFocoValido ? (
            <button
              type="button"
              onClick={() => {
                intentarNavegacionFoco({ grupoId: "", periodo: "" }, () => {
                  focoUrl.clearFocoEnUrl();
                  setGrupoId("");
                });
              }}
              className="h-11 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Volver a consola
            </button>
          ) : null}
        </div>
        {focoUrl.tieneFocoValido ? (
          <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-950">
            Trabajando en: {focoUrl.grupoLabelUrl || grupoLabel} · {focoUrl.periodoUrl}
          </p>
        ) : consolaPanoramaJefe ? null : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
            Por favor, elegí un grupo de trabajo y un período, luego pulsá Ver.
          </p>
        )}
      </Card>

      {consolaPanoramaJefe ? (
        <Card className="px-4 py-3">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Consola de triple horizonte</h2>
          <p className="mb-3 text-xs text-slate-600">
            Mes anterior (cierre), mes actual (operación) y mes próximo (planificación) de tus grupos vigentes.
            Pulsá una tarjeta para hacer zoom en ese sector y período.
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            {periodosPermitidos.map((p, idx) => (
              <ConsolaTripleHorizonteSeccion
                key={`pan-${p}`}
                idx={idx}
                tituloHorizonte={HORIZONTE_CONSOLA_TITULOS[idx]}
                subtituloMes={labelPeriodoCard(p, idx).split(" · ")[1]}
                abierto={Boolean(consolaColAbierta[idx])}
                onToggle={toggleConsolaCol}
              >
                  {(gruposPorPeriodo[p] || []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                      Sin grupos disponibles.
                    </p>
                  ) : (
                    (gruposPorPeriodo[p] || []).map((g) => {
                      const meta = resumenGrupoPeriodo[p]?.[g.id] || { estado: "SIN_PLAN", cantidad: 0 };
                      const esHistorico = idx === 0;
                      const borradorRechazado =
                        esHistorico && borradorRechazadoEnItems(meta.items);
                      const verEquipoSinPlan =
                        meta.estado === "SIN_PLAN" && !esHistorico && meta.hay_planificados === false;
                      return (
                        <button
                          key={`pan-${p}-${g.id}`}
                          type="button"
                          onClick={() => void seleccionarTarjetaPlan(p, g, esHistorico)}
                          className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${estiloTarjetaMisTurnos(
                            meta.estado,
                            false,
                            esHistorico,
                            verEquipoSinPlan,
                            borradorRechazado,
                          )}`}
                        >
                          <span className="font-medium">{g.label}</span>
                          <span className="text-xs opacity-85">
                            {iconoEstadoGrupo(meta.estado)}{" "}
                            {etiquetaEstadoTarjeta(
                              meta.estado,
                              esHistorico,
                              meta.hay_planificados,
                              borradorRechazado,
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
              </ConsolaTripleHorizonteSeccion>
            ))}
          </div>
        </Card>
      ) : null}

      {focoUrl.tieneFocoValido ? (
      <>
      {(() => {
        const idxFoco = periodosPermitidos.indexOf(periodo);
        const esHistoricoFoco = idxFoco === 0;
        const metaFoco = resumenGrupoPeriodo[periodo]?.[grupoId] || {
          estado: "SIN_PLAN",
          cantidad: 0,
          items: planes,
        };
        const estadoFoco =
          metaFoco.items?.length > 0 ? estadoResumenGrupo(metaFoco.items) : metaFoco.estado;
        const borradorRechazadoFoco =
          esHistoricoFoco && borradorRechazadoEnItems(metaFoco.items);
        const verEquipoFoco =
          estadoFoco === "SIN_PLAN" && !esHistoricoFoco && metaFoco.hay_planificados === false;
        const etiquetaAccion =
          estadoFoco === "SIN_PLAN"
            ? verEquipoFoco
              ? "Ver equipo del sector"
              : "Crear turno mensual"
            : estadoFoco === "BORRADOR" || estadoFoco === "EN_REVISION"
              ? "Editar plan"
              : "Gestionar plan";
        return (
          <Card className="px-4 py-3">
            <h2 className="mb-1 text-sm font-semibold text-slate-800">Plan del foco</h2>
            <p className="mb-3 text-xs text-slate-600">
              Paridad con grilla operativa: un sector y un período por vista. Cambiá el foco arriba y pulsá
              Ver para otro mes o grupo.
            </p>
            <div
              className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${estiloTarjetaMisTurnos(
                estadoFoco,
                true,
                esHistoricoFoco,
                verEquipoFoco,
                borradorRechazadoFoco,
              )}`}
            >
              <div>
                <p className="text-sm font-semibold">{grupoLabel}</p>
                <p className="text-xs opacity-90">
                  {labelPeriodoCard(periodo, idxFoco >= 0 ? idxFoco : 1).split(" · ")[1]} · {periodo}
                </p>
                <p className="mt-1 text-xs font-medium">
                  {iconoEstadoGrupo(estadoFoco)}{" "}
                  {etiquetaEstadoTarjeta(
                    estadoFoco,
                    esHistoricoFoco,
                    metaFoco.hay_planificados,
                    borradorRechazadoFoco,
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={loading || operando}
                onClick={() =>
                  void seleccionarTarjetaPlan(
                    periodo,
                    { id: grupoId, label: grupoLabel },
                    esHistoricoFoco,
                  )
                }
                className="h-11 shrink-0 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {etiquetaAccion}
              </button>
            </div>
          </Card>
        );
      })()}

      {/* Feedback */}
      {grupoId && periodo && resumenGrupoPeriodo[periodo]?.[grupoId]?.requiere_plan_individual ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-medium">Requiere plan individual para agente(s) nuevo(s)</p>
          <p className="mt-1 text-xs text-amber-800">
            Hay personal planificado en el grupo que no figura en el turno mensual vigente. Creá un plan de
            incorporación paralelo: solo editás a los agentes nuevos; el plan operativo habilitado no se toca.
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
            {(resumenGrupoPeriodo[periodo][grupoId].agentes_nuevos || []).slice(0, 5).map((a) => (
              <li key={a.persona_id}>
                {a.persona_label || a.persona_id}
                {a.persona_dni ? ` · DNI ${a.persona_dni}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {planPrincipalMes?.estado === "HABILITADO" && !planIncorporacionMes ? (
              <button
                type="button"
                disabled={operando}
                onClick={() => void handleIniciarIncorporacion()}
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
              >
                Incorporar agente(s)
              </button>
            ) : null}
            {planIncorporacionMes ? (
              <button
                type="button"
                disabled={operando}
                onClick={() => abrirEditorIncorporacion(planIncorporacionMes)}
                className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Continuar incorporación ({LABEL_ESTADO[planIncorporacionMes.estado] || planIncorporacionMes.estado})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {grupoId && periodo && (planPrincipalMes || planIncorporacionMes) ? (
        <Card className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Planes del período · {grupoLabel} · {periodo}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {planPrincipalMes ? (() => {
              const pp = planPrincipalMes;
              const editable =
                pp.estado === "BORRADOR" || pp.estado === "EN_REVISION";
              const soloLectura =
                pp.estado === "HABILITADO" || pp.estado === "CERRADO";
              const rechazado = esBorradorRechazado(pp);
              const cardCls = soloLectura
                ? "border-emerald-200 bg-emerald-50/80"
                : editable
                  ? "border-amber-200 bg-amber-50/80"
                  : "border-slate-200 bg-slate-50/80";
              const titleCls = soloLectura ? "text-emerald-900" : editable ? "text-amber-900" : "text-slate-900";
              const subCls = soloLectura ? "text-emerald-800" : editable ? "text-amber-800" : "text-slate-700";
              const idCls = soloLectura ? "text-emerald-700" : editable ? "text-amber-700" : "text-slate-600";
              const permEnviarPp = permisosPlan(pp.estado);
              return (
                <div className={`rounded-xl border p-4 ${cardCls}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-semibold ${titleCls}`}>
                        {soloLectura ? "Plan operativo" : rechazado ? "Corregir rechazo" : "Plan mensual"}
                      </p>
                      <p className={`mt-0.5 text-xs ${subCls}`}>
                        {soloLectura
                          ? "Solo lectura cuando está habilitado."
                          : rechazado
                            ? "Rechazado por RRHH: editá y reenviá cuando esté listo."
                            : "Borrador o en circuito de aprobación."}
                      </p>
                      {rechazado && pp.observaciones_rechazo ? (
                        <p className={`mt-1 text-xs ${subCls}`}>
                          Motivo: {pp.observaciones_rechazo}
                        </p>
                      ) : null}
                      <p className={`mt-2 font-mono text-[11px] ${idCls}`}>{pp.id}</p>
                    </div>
                    <BadgeEstadoPlan estado={pp.estado} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => abrirPlanDetalle(pp)}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm ${
                        soloLectura
                          ? "border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {soloLectura ? "Ver plan operativo" : "Ver"}
                    </button>
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => setPlanEdicion(pp)}
                        className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-amber-900 hover:bg-amber-50"
                      >
                        Editar plan
                      </button>
                    ) : null}
                    {editable ? (
                      <button
                        type="button"
                        disabled={
                          operando
                          || huecosPlanPrincipal > 0
                          || !permEnviarPp.enviar.permitido
                        }
                        title={
                          huecosPlanPrincipal > 0
                            ? tooltipBloqueoHuecosPlan(huecosPlanPrincipal)
                            : !permEnviarPp.enviar.permitido
                              ? copyMotivoRechazoTeoriaUsuario(permEnviarPp.enviar.motivoRechazo)
                              : undefined
                        }
                        onClick={() => void handleTransicion("enviar", pp.id)}
                        className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pp.estado === "EN_REVISION" ? "Reenviar" : "Enviar"}
                      </button>
                    ) : null}
                    {pp.estado === "ENVIADO" ? (
                      <p className="text-xs text-slate-700">Enviado — pendiente de aprobación superior.</p>
                    ) : null}
                  </div>
                </div>
              );
            })() : null}
            {planIncorporacionMes ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-violet-900">Incorporación</p>
                    <p className="mt-0.5 text-xs text-violet-800">Borrador o en circuito de aprobación.</p>
                    <p className="mt-2 font-mono text-[11px] text-violet-700">{planIncorporacionMes.id}</p>
                  </div>
                  <BadgeEstadoPlan estado={planIncorporacionMes.estado} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(planIncorporacionMes.estado === "BORRADOR" ||
                    planIncorporacionMes.estado === "EN_REVISION") && (
                    <button
                      type="button"
                      onClick={() => abrirEditorIncorporacion(planIncorporacionMes)}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm text-violet-800 hover:bg-violet-50"
                    >
                      Editar incorporación
                    </button>
                  )}
                  {(planIncorporacionMes.estado === "BORRADOR" ||
                    planIncorporacionMes.estado === "EN_REVISION") && (
                    <button
                      type="button"
                      disabled={
                        operando
                        || huecosPlanIncorporacion > 0
                        || !permisosPlan(planIncorporacionMes.estado).enviar.permitido
                      }
                      title={
                        huecosPlanIncorporacion > 0
                          ? tooltipBloqueoHuecosPlan(huecosPlanIncorporacion)
                          : !permisosPlan(planIncorporacionMes.estado).enviar.permitido
                            ? copyMotivoRechazoTeoriaUsuario(
                                permisosPlan(planIncorporacionMes.estado).enviar.motivoRechazo,
                              )
                            : undefined
                      }
                      onClick={() => void handleTransicion("enviar", planIncorporacionMes.id)}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {planIncorporacionMes.estado === "EN_REVISION" ? "Reenviar" : "Enviar"}
                    </button>
                  )}
                  {planIncorporacionMes.estado === "ENVIADO" ? (
                    <p className="text-xs text-violet-700">Enviado — pendiente de aprobación superior.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

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
      </>
      ) : null}

      {mostrarAprobacionTurnos && (esJefe || focoUrl.tieneFocoValido) ? (
        <Card className="px-4 py-3">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Aprobación de Turnos Mensuales</h2>
          <p className="mb-3 text-xs text-slate-600">Bandeja tipo inbox para planes enviados/en revisión de grupos hijos.</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {periodosPermitidos.map((p, idx) => (
              <ConsolaTripleHorizonteSeccion
                key={`inbox-${p}`}
                idx={idx}
                tituloHorizonte={HORIZONTE_CONSOLA_TITULOS[idx]}
                subtituloMes={labelPeriodoCard(p, idx).split(" · ")[1]}
                abierto={Boolean(consolaColAbierta[idx])}
                onToggle={toggleConsolaCol}
              >
                  {(gruposPorPeriodo[p] || [])
                    .filter((g) => grupoTieneInboxPendiente(resumenGrupoPeriodo[p]?.[g.id]?.items || []))
                    .map((g) => {
                      const meta = resumenGrupoPeriodo[p]?.[g.id] || { estado: "SIN_PLAN", cantidad: 0, items: [] };
                      const estadoInbox = estadoInboxGrupo(meta.items || []);
                      const esInc = Boolean(
                        planIncorporacionActivo(meta.items || []) &&
                          (estadoInbox === "ENVIADO" || estadoInbox === "EN_REVISION"),
                      );
                      const activo = grupoId === g.id && periodo === p;
                      return (
                        <button
                          key={`inbox-${p}-${g.id}`}
                          type="button"
                          onClick={() => void seleccionarTarjetaPlan(p, g, idx === 0)}
                          className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${estiloTarjetaGrupo(estadoInbox, activo)}`}
                        >
                          <span className="font-medium">
                            {g.label}
                            {esInc ? (
                              <span className="ml-1 text-[10px] font-normal text-amber-800">· Incorp.</span>
                            ) : null}
                          </span>
                          <span className="text-xs opacity-85">
                            {iconoEstadoGrupo(estadoInbox)} {LABEL_ESTADO[estadoInbox] || estadoInbox}
                          </span>
                        </button>
                      );
                    })}
                  {(gruposPorPeriodo[p] || []).filter((g) =>
                    grupoTieneInboxPendiente(resumenGrupoPeriodo[p]?.[g.id]?.items || []),
                  ).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                      Sin pendientes de aprobación.
                    </p>
                  ) : null}
              </ConsolaTripleHorizonteSeccion>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Modal Grilla Mensual / Plan Perpetuo */}
      {planEdicion && planEdicion.tipo_plan === "mensual" && (
        <GrillaMensualEditor
          plan={planEdicion.nuevo || planEdicion.modoVistaEquipo ? null : planEdicion}
          modoVistaEquipo={Boolean(planEdicion.modoVistaEquipo)}
          modoIncorporacionAgentesNuevos={
            Boolean(planEdicion.modoIncorporacion) || esPlanIncorporacion(planEdicion)
          }
          agentesNuevosPermitidos={
            planEdicion.modoIncorporacion || esPlanIncorporacion(planEdicion)
              ? planEdicion.agentesNuevos || []
              : []
          }
          grupoId={grupoId}
          grupoLabel={grupoLabel}
          periodo={periodo}
          guardando={operando}
          errorGuardar={error}
          puedeGuardarPlan={permisosPlanEdicion?.guardar?.permitido !== false}
          motivoGuardarDeshabilitado={
            permisosPlanEdicion && !permisosPlanEdicion.guardar.permitido
              ? copyMotivoRechazoTeoriaUsuario(permisosPlanEdicion.guardar.motivoRechazo)
              : undefined
          }
          onGuardar={handleGuardarBorrador}
          onCerrar={() => {
            setPlanEdicion(null);
            setError("");
          }}
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
            {planOpciones.mesHistoricoRechazado && planOpcionesResuelto && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Mes anterior: podés corregir y reenviar este plan rechazado por RRHH.
                {planOpcionesResuelto.observaciones_rechazo ? (
                  <p className="mt-1 text-amber-800">
                    Motivo: {planOpcionesResuelto.observaciones_rechazo}
                  </p>
                ) : null}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {planOpcionesResuelto ? (
                <>
                  <button type="button" onClick={() => { void abrirPlanDetalle(planOpcionesResuelto); setPlanOpciones(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Ver
                  </button>
                  {(planOpcionesResuelto.estado === "BORRADOR" || planOpcionesResuelto.estado === "EN_REVISION") &&
                    !esPlanIncorporacion(planOpcionesResuelto) && (
                    <button type="button" onClick={() => { setPlanEdicion(planOpcionesResuelto); setPlanOpciones(null); }} className="rounded-lg border border-indigo-300 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">
                      Editar
                    </button>
                  )}
                  {(planOpcionesResuelto.estado === "BORRADOR" || planOpcionesResuelto.estado === "EN_REVISION") && (
                    <button
                      type="button"
                      disabled={
                        operando
                        || huecosPlanOpciones > 0
                        || !permisosPlan(planOpcionesResuelto.estado).enviar.permitido
                      }
                      title={
                        huecosPlanOpciones > 0
                          ? tooltipBloqueoHuecosPlan(huecosPlanOpciones)
                          : !permisosPlan(planOpcionesResuelto.estado).enviar.permitido
                            ? copyMotivoRechazoTeoriaUsuario(
                                permisosPlan(planOpcionesResuelto.estado).enviar.motivoRechazo,
                              )
                            : undefined
                      }
                      onClick={() => void handleTransicion("enviar", planOpcionesResuelto.id)}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {planOpcionesResuelto.estado === "EN_REVISION" ? "Reenviar" : "Enviar"}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle read-only — mismo marco visual que Ver turnos del equipo */}
      {planDetalle && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setPlanDetalle(null)}>
          <div className="flex h-full w-full flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Detalle del plan <span className="font-mono text-sm text-slate-500">{planDetalle.id}</span>
                </h2>
                <p className="text-sm text-slate-500">
                  {planDetalle.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}
                  {" · "}
                  <BadgeEstadoPlan estado={planDetalle.estado} />
                  {" · "}
                  {planDetalle.grupo_label || grupoLabel || planDetalle.grupo_id}
                  {planDetalle.periodo ? ` · ${planDetalle.periodo}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanDetalle(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-5 text-sm text-slate-700">
              {planDetalle.vigente_desde && (
                <p className="mt-2"><span className="font-medium">Vigencia:</span> {planDetalle.vigente_desde} → {planDetalle.vigente_hasta || "∞"}</p>
              )}
              <p><span className="font-medium">Agentes:</span> {planDetalle.agentes?.length || 0}</p>
              {planDetalle.observaciones_rechazo && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  <p className="text-xs font-medium">Observaciones de rechazo:</p>
                  <p>{planDetalle.observaciones_rechazo}</p>
                </div>
              )}
              {planDetalle.tipo_plan === "mensual" && (
                <div className="mt-3 flex min-h-[50vh] flex-col">
                  <h3 className="mb-1 text-sm font-semibold text-slate-800">Grilla aprobada (histórico)</h3>
                  {planDetalleGrillaLoading ? (
                    <p className="text-sm text-slate-600">Cargando grilla aprobada…</p>
                  ) : (
                    <PlanGrillaAprobadaTable
                      conLeyenda
                      grillaAprobada={planDetalleGrilla}
                      labelsPorPersona={{
                        ...Object.fromEntries(
                          (planDetalle.agentes || []).map((ag) => [
                            ag.persona_id,
                            { nombre: ag.nombre || ag.nombre_completo, dni: ag.dni },
                          ]),
                        ),
                        ...planDetalleGrillaLabels,
                      }}
                    />
                  )}
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p className="font-semibold">Referencia de lectura</p>
                    <p>
                      Foto histórica del plan. Si después se deshabilita una asignación, puede no coincidir
                      con la grilla operativa vigente.
                    </p>
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
