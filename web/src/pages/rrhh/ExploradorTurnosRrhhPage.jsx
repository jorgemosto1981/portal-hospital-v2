import { useCallback, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import BadgeEstadoPlan from "../../components/ui/BadgeEstadoPlan.jsx";
import {
  callListarPlanesTurnoServicio,
  callListarContextoPlanGrupo,
  callRevertirPlanTurnoServicio,
  callEliminarPlanTurnoServicio,
} from "../../services/callables.js";
import { etiquetaCeldaPlanDisplay, claseCeldaPlanDisplay } from "../../features/planes/planGrillaCeldaDisplay.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";

function etiquetaGrupo(row) {
  return String(row.nombre || row.codigo || row.titulo || "").trim() || String(row.id || "");
}

function periodoActualYm() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function labelAgentePlan(ag) {
  return String(ag?.persona_label || "").trim() || String(ag?.persona_id || "—");
}

function columnasDesdeAgentes(agentes = []) {
  const set = new Set();
  for (const ag of agentes) {
    const dias = ag?.dias && typeof ag.dias === "object" ? Object.keys(ag.dias) : [];
    dias.forEach((d) => set.add(d));
  }
  return [...set].sort();
}

function etiquetaCeldaDia(celda) {
  if (!celda || typeof celda !== "object") return "";
  if (celda.tipo_dia === "franco") return "F";
  const turno = String(celda.turno_id || celda.rda_turno_id || "").trim();
  const ingreso = String(celda.ingreso || "").trim();
  const egreso = String(celda.egreso || "").trim();
  if (turno && ingreso && egreso) return `${turno} ${ingreso}-${egreso}`;
  if (turno) return turno;
  if (ingreso && egreso) return `${ingreso}-${egreso}`;
  if (ingreso) return ingreso;
  return "";
}

function claseCeldaDia(celda) {
  if (!celda || typeof celda !== "object") return "bg-white";
  if (celda.tipo_dia === "franco") return "bg-slate-100 text-slate-700";
  if (celda.es_feriado === true || celda.tipo_dia === "feriado" || celda.tipo_dia === "asueto") {
    return "bg-amber-100 text-amber-900";
  }
  if (celda.turno_id || celda.rda_turno_id) return "bg-emerald-50 text-emerald-900";
  return "bg-white";
}

const MESES = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];
const GRUPO_TODOS_ID = "__TODOS__";

export default function ExploradorTurnosRrhhPage() {
  const [periodoBase] = useState(periodoActualYm());
  const [anioInicial, mesInicial] = String(periodoBase).split("-");
  const [grupos, setGrupos] = useState([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [grupoId, setGrupoId] = useState("");
  const [grupoBusqueda, setGrupoBusqueda] = useState("");
  const [mostrarSugerenciasGrupo, setMostrarSugerenciasGrupo] = useState(false);
  const [mes, setMes] = useState(mesInicial || "01");
  const [anio, setAnio] = useState(anioInicial || String(new Date().getFullYear()));
  const [estado, setEstado] = useState("");
  const [items, setItems] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busquedaEjecutada, setBusquedaEjecutada] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [operando, setOperando] = useState(false);
  const [planVista, setPlanVista] = useState(null);
  const [planVistaRegimenes, setPlanVistaRegimenes] = useState({});
  const [planDetalle, setPlanDetalle] = useState(null);
  const [modalRevertir, setModalRevertir] = useState(null);
  const [obsRevertir, setObsRevertir] = useState("");
  const [modalEliminar, setModalEliminar] = useState(null);
  const [confirmarEliminarPaso1, setConfirmarEliminarPaso1] = useState(false);
  const [confirmarEliminarPaso2, setConfirmarEliminarPaso2] = useState(false);
  const [justificacionEliminar, setJustificacionEliminar] = useState("");
  const [modalTab, setModalTab] = useState("resumen");
  const PAGE_SIZE = 10;

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 5000);
  };

  const abrirGrillaPlan = useCallback(async (plan) => {
    setPlanVista(plan);
    setPlanVistaRegimenes({});
    if (plan?.tipo_plan !== "mensual" || !plan?.grupo_id || !plan?.periodo) return;
    try {
      const res = await callListarContextoPlanGrupo({
        grupo_id: plan.grupo_id,
        periodo: plan.periodo,
      });
      setPlanVistaRegimenes(res.data?.regimenes || {});
    } catch {
      setPlanVistaRegimenes({});
    }
  }, []);

  const cargarGrupos = useCallback(async () => {
    if (grupos.length > 0) return;
    setGruposLoading(true);
    try {
      const rows = await listarColeccionLaboral("grupos_de_trabajo", 800);
      const activos = rows.filter((r) => r.activo !== false);
      activos.sort((a, b) => etiquetaGrupo(a).localeCompare(etiquetaGrupo(b), "es"));
      const base = [{ id: GRUPO_TODOS_ID, label: "Todos" }, ...activos.map((r) => ({ id: r.id, label: etiquetaGrupo(r) }))];
      setGrupos(base);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los grupos.");
    } finally {
      setGruposLoading(false);
    }
  }, [grupos.length]);

  const buscarPlanes = useCallback(async () => {
    if (!grupoId) return;
    setLoading(true);
    setError("");
    setBusquedaEjecutada(true);
    const periodo = `${String(anio || "").trim()}-${String(mes || "").padStart(2, "0")}`;
    try {
      if (grupoId === GRUPO_TODOS_ID) {
        const gruposActivos = grupos.filter((g) => g.id !== GRUPO_TODOS_ID);
        const respuestas = await Promise.allSettled(
          gruposActivos.map((g) =>
            callListarPlanesTurnoServicio({
              grupo_id: g.id,
              periodo: String(periodo || "").trim() || undefined,
              estado: String(estado || "").trim() || undefined,
            }),
          ),
        );
        const merged = [];
        for (const r of respuestas) {
          if (r.status === "fulfilled") {
            const itemsOk = (r.value?.data?.items || []).filter((it) => it?.eliminado !== true);
            merged.push(...itemsOk);
          }
        }
        setItems(merged);
      } else {
        const res = await callListarPlanesTurnoServicio({
          grupo_id: grupoId,
          periodo: String(periodo || "").trim() || undefined,
          estado: String(estado || "").trim() || undefined,
        });
        setItems((res.data?.items || []).filter((it) => it?.eliminado !== true));
      }
      setPagina(1);
    } catch (e) {
      setError(e?.message || "No se pudo listar planes.");
    } finally {
      setLoading(false);
    }
  }, [grupoId, anio, mes, estado, grupos]);

  const grupoLabel = useMemo(() => grupos.find((g) => g.id === grupoId)?.label || grupoId || "-", [grupos, grupoId]);
  const limpiarGrupoSeleccionado = useCallback(() => {
    setGrupoId("");
    setGrupoBusqueda("");
    setMostrarSugerenciasGrupo(false);
    setItems([]);
    setPagina(1);
    setBusquedaEjecutada(false);
  }, []);

  const anioActual = new Date().getFullYear();
  const anios = useMemo(() => {
    const list = [];
    for (let y = anioActual - 3; y <= anioActual + 3; y += 1) list.push(String(y));
    return list;
  }, [anioActual]);
  const gruposFiltrados = useMemo(() => {
    const q = String(grupoBusqueda || "").trim().toLowerCase();
    if (!q) return grupos.slice(0, 30);
    return grupos
      .filter((g) => String(g.label || "").toLowerCase().includes(q) || String(g.id || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [grupos, grupoBusqueda]);
  const itemsOrdenados = useMemo(() => {
    const parsePeriodo = (v) => {
      const s = String(v || "");
      const m = s.match(/^(\d{4})-(\d{2})$/);
      if (!m) return -Infinity;
      return Number(m[1]) * 100 + Number(m[2]);
    };
    const rankEstado = (e) => {
      switch (String(e || "").toUpperCase()) {
        case "EN_REVISION":
          return 5;
        case "ENVIADO":
          return 4;
        case "HABILITADO":
          return 3;
        case "BORRADOR":
          return 2;
        case "CERRADO":
          return 1;
        default:
          return 0;
      }
    };
    return [...items].sort((a, b) => {
      const p = parsePeriodo(b.periodo) - parsePeriodo(a.periodo);
      if (p !== 0) return p;
      const e = rankEstado(b.estado) - rankEstado(a.estado);
      if (e !== 0) return e;
      return String(b.id || "").localeCompare(String(a.id || ""), "es");
    });
  }, [items]);
  const totalPaginas = Math.max(1, Math.ceil(itemsOrdenados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const itemsPagina = useMemo(() => {
    const start = (paginaActual - 1) * PAGE_SIZE;
    return itemsOrdenados.slice(start, start + PAGE_SIZE);
  }, [itemsOrdenados, paginaActual]);

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Explorador de Turnos RRHH</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
          Consulta histórica, actual y futura de turnos por grupo/periodo con acciones de revisión.
        </p>
      </header>

      {feedback && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feedback}</div>}
      {error && (
        <Card className="border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError("")} className="mt-1 text-xs text-red-600 underline">Cerrar</button>
        </Card>
      )}

      <Card className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={cargarGrupos}
            disabled={gruposLoading}
            className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50"
          >
            {gruposLoading ? "Cargando grupos..." : "Cargar grupos"}
          </button>
          <h2 className="text-sm font-semibold text-slate-800">Filtros de exploración</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Grupo</label>
            <div className="relative">
              <input
                value={grupoBusqueda}
                onFocus={() => setMostrarSugerenciasGrupo(true)}
                onBlur={() => setTimeout(() => setMostrarSugerenciasGrupo(false), 120)}
                onChange={(e) => {
                  setGrupoBusqueda(e.target.value);
                  setGrupoId("");
                  setMostrarSugerenciasGrupo(true);
                }}
                placeholder={grupos.length > 0 ? "Buscar por nombre o ID..." : "Primero cargá grupos..."}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {grupoId && (
                <button
                  type="button"
                  onClick={limpiarGrupoSeleccionado}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                >
                  Limpiar
                </button>
              )}
              {mostrarSugerenciasGrupo && grupos.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {gruposFiltrados.length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-500">Sin coincidencias.</p>
                  )}
                  {gruposFiltrados.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setGrupoId(g.id);
                        setGrupoBusqueda(g.label);
                        setItems([]);
                        setPagina(1);
                        setBusquedaEjecutada(false);
                        setMostrarSugerenciasGrupo(false);
                      }}
                      className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {grupoId && (
              <p className="mt-1 text-xs text-emerald-700">
                Grupo seleccionado: <span className="font-semibold">{grupoLabel}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {anios.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ENVIADO">Enviado</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="HABILITADO">Habilitado</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={buscarPlanes}
              disabled={loading || !grupoId}
              className="min-h-11 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </Card>

      {!loading && items.length === 0 && (
        <Card className="px-4 py-8 text-center">
          {!grupoId ? (
            <p className="text-sm text-slate-500">Seleccioná grupo y buscá para ver planes de cualquier período/estado.</p>
          ) : busquedaEjecutada ? (
            <p className="text-sm text-slate-500">
              Sin resultados para <span className="font-medium">{grupoLabel}</span> en <span className="font-medium">{String(mes).padStart(2, "0")}/{anio}</span>
              {estado ? <> · estado <span className="font-medium">{estado}</span></> : <> · todos los estados</>}.
            </p>
          ) : (
            <p className="text-sm text-slate-500">Grupo seleccionado. Presioná `Buscar` para cargar resultados.</p>
          )}
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{itemsOrdenados.length} plan(es) en {grupoLabel}.</p>
          {itemsPagina.map((plan) => (
            <Card key={plan.id} className="px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{plan.id}</span>
                    <BadgeEstadoPlan estado={plan.estado} />
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Período:</span> {plan.periodo || "-"} · <span className="font-medium">Grupo:</span> {plan.grupo_label || plan.grupo_id}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Agentes:</span> {plan.agentes?.length || 0}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void abrirGrillaPlan(plan)}
                    className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    VER
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanDetalle(plan);
                      setModalTab("resumen");
                      setJustificacionEliminar("");
                    }}
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    DETALLES
                  </button>
                  {plan.estado === "HABILITADO" && (
                    <button
                      type="button"
                      disabled={operando}
                      onClick={() => { setModalRevertir(plan.id); setObsRevertir(""); }}
                      className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      Revertir a revisión
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={operando}
                    onClick={() => {
                      setModalEliminar(plan);
                      setJustificacionEliminar("");
                      setConfirmarEliminarPaso1(false);
                      setConfirmarEliminarPaso2(false);
                    }}
                    className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </Card>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
            <span>Página {paginaActual} de {totalPaginas} · {itemsOrdenados.length} resultado(s)</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={paginaActual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {planVista && (
        <div className="fixed inset-0 z-50 bg-black/50 p-2 md:p-4" onClick={() => setPlanVista(null)}>
          <div className="mx-auto flex h-full w-full max-w-[98vw] flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Grilla del turno</h3>
                <p className="text-xs text-slate-500">
                  {planVista.id} · {planVista.grupo_label || planVista.grupo_id} · {planVista.periodo || "Perpetuo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanVista(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </header>
            <div className="flex-1 overflow-auto p-4">
              {planVista.tipo_plan !== "mensual" ? (
                <Card className="px-4 py-6 text-center">
                  <p className="text-sm text-slate-600">
                    Este plan es perpetuo y no trae grilla mensual de días en el payload actual.
                  </p>
                </Card>
              ) : (
                <div className="overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm">
                  <table className="min-w-full border-collapse text-[10px]">
                    <thead>
                      <tr>
                        <th className="h-10 min-w-[13rem] border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs font-semibold text-slate-700">
                          Persona
                        </th>
                        {columnasDesdeAgentes(planVista.agentes || []).map((dia) => (
                          <th key={dia} className="h-10 min-w-[5rem] border border-slate-300 bg-slate-100 px-1 py-1 text-center text-[10px] font-semibold text-slate-700">
                            {dia.slice(8, 10)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-300">
                      {(planVista.agentes || []).map((ag) => (
                        <tr key={`${ag.persona_id}-${ag.hlg_id || "-"}`} className="bg-white">
                          <td className="max-w-[14rem] truncate border border-slate-300 px-2 py-3 text-left text-xs font-semibold text-slate-900">
                            {labelAgentePlan(ag)}
                          </td>
                          {columnasDesdeAgentes(planVista.agentes || []).map((dia) => {
                            const regimen = planVistaRegimenes[ag.regimen_horario_id] || null;
                            const hlgMeta = { regimen_fecha_ancla: ag.regimen_fecha_ancla || null };
                            const etiqueta = etiquetaCeldaPlanDisplay({
                              celdaPlan: ag?.dias?.[dia],
                              regimen,
                              ymd: dia,
                              hlgMeta,
                            });
                            return (
                            <td
                              key={`${ag.persona_id}-${dia}`}
                              className={`h-12 border border-slate-300 px-1 py-1 text-center text-[10px] leading-tight ${claseCeldaPlanDisplay(ag?.dias?.[dia], regimen, dia, hlgMeta)}`}
                            >
                              {etiqueta || "—"}
                            </td>
                            );
                          })}
                        </tr>
                      ))}
                      {(planVista.agentes || []).length === 0 && (
                        <tr>
                          <td className="border border-slate-300 px-3 py-4 text-xs text-slate-500" colSpan={Math.max(2, columnasDesdeAgentes(planVista.agentes || []).length + 1)}>
                            Sin agentes para visualizar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {planDetalle && (
        <div className="fixed inset-0 z-50 bg-black/40 p-2 md:p-4" onClick={() => setPlanDetalle(null)}>
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Detalle de plan</h3>
                <p className="text-xs text-slate-500">{planDetalle.id} · {planDetalle.grupo_label || planDetalle.grupo_id} · {planDetalle.periodo || "-"}</p>
              </div>
              <button type="button" onClick={() => setPlanDetalle(null)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cerrar</button>
            </header>
            <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "resumen", label: "Resumen" },
                  { id: "agentes", label: "Agentes" },
                  { id: "historial", label: "Historial" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setModalTab(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      modalTab === t.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {modalTab === "resumen" && (
                <>
                  <Card className="px-4 py-3">
                    <h4 className="mb-2 text-sm font-semibold text-slate-800">Datos disponibles del plan</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="text-sm text-slate-700"><span className="font-medium">Estado:</span> {planDetalle.estado || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Tipo:</span> {planDetalle.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Grupo:</span> {planDetalle.grupo_label || planDetalle.grupo_id || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Período:</span> {planDetalle.periodo || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Vigente desde:</span> {planDetalle.vigente_desde || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Vigente hasta:</span> {planDetalle.vigente_hasta || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Creado:</span> {formatDateTime(planDetalle.creado_en)}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Actualizado:</span> {formatDateTime(planDetalle.actualizado_en)}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Creado por (persona):</span> {planDetalle.creado_por_persona_id || "—"}</p>
                      <p className="text-sm text-slate-700"><span className="font-medium">Creado por (uid):</span> {planDetalle.creado_por_uid || "—"}</p>
                    </div>
                  </Card>

                  <Card className="px-4 py-3">
                    <h4 className="mb-2 text-sm font-semibold text-slate-800">Trazabilidad y validaciones</h4>
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Aprobación pendiente:</span>{" "}
                      {planDetalle.aprobacion_pendiente?.tipo || "—"}
                      {planDetalle.aprobacion_pendiente?.destino_persona_id ? (
                        <> · {planDetalle.aprobacion_pendiente.destino_persona_id}</>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Obs. revisión:</span> {String(planDetalle.observaciones_revision || "").trim() || "—"}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">Obs. rechazo:</span> {String(planDetalle.observaciones_rechazo || "").trim() || "—"}
                    </p>
                    {Array.isArray(planDetalle.warnings) && planDetalle.warnings.length > 0 && (
                      <p className="text-sm text-amber-700">
                        <span className="font-medium">Warnings:</span> {planDetalle.warnings.length}
                      </p>
                    )}
                  </Card>
                </>
              )}

              {modalTab === "agentes" && (
                <Card className="px-4 py-3">
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Agentes incluidos</h4>
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Total:</span> {planDetalle.agentes?.length || 0}
                  </p>
                  <div className="mt-2 max-h-52 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {(planDetalle.agentes || []).slice(0, 60).map((ag) => (
                      <p key={`${ag.persona_id}-${ag.hlg_id || "-"}`} className="text-xs text-slate-700">
                        {ag.persona_label || ag.persona_id}
                        {ag.persona_dni ? ` · DNI ${ag.persona_dni}` : ""}
                        {ag.regimen_horario_id ? ` · Reg ${ag.regimen_horario_id}` : ""}
                        {ag.hlg_id ? ` · HLG ${ag.hlg_id}` : ""}
                      </p>
                    ))}
                    {(planDetalle.agentes || []).length === 0 && (
                      <p className="text-xs text-slate-500">Sin agentes.</p>
                    )}
                  </div>
                </Card>
              )}

              {modalTab === "historial" && (
                <Card className="px-4 py-3">
                  <details open>
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      Historial de aprobaciones ({(planDetalle.historial_aprobaciones || []).length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {(planDetalle.historial_aprobaciones || []).length === 0 && (
                        <p className="text-xs text-slate-500">Sin eventos de historial.</p>
                      )}
                      {(planDetalle.historial_aprobaciones || []).map((h, idx) => (
                        <div key={`${h?.accion || "evt"}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs text-slate-700">
                            <span className="font-semibold">{labelActorHistorial(h)}</span> · {String(h?.accion || "—").toUpperCase()} · {h?.rol || "—"}
                          </p>
                          <p className="text-xs text-slate-600">Fecha: {h?.fecha || "—"} {h?.hora ? ` ${h.hora}` : ""}</p>
                          {String(h?.observaciones || "").trim() && (
                            <p className="text-xs text-slate-600">Obs: {h.observaciones}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </Card>
              )}

            </div>
          </div>
        </div>
      )}

      {modalRevertir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalRevertir(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">Motivo de la revisión</h3>
            <p className="mt-1 text-sm text-slate-500">Indicá por qué se revierte este plan habilitado.</p>
            <textarea
              value={obsRevertir}
              onChange={(e) => setObsRevertir(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Motivo (obligatorio, mín. 3 caracteres)"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalRevertir(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={obsRevertir.trim().length < 3 || operando}
                onClick={async () => {
                  setOperando(true);
                  try {
                    await callRevertirPlanTurnoServicio({ plan_id: modalRevertir, observaciones: obsRevertir.trim() });
                    showFeedback("Plan revertido a revisión.");
                    setModalRevertir(null);
                    buscarPlanes();
                  } catch (e) {
                    setError(e?.message || "No se pudo revertir el plan.");
                  } finally {
                    setOperando(false);
                  }
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                {operando ? "Procesando..." : "Revertir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalEliminar(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-slate-900">Eliminar plan (borrado lógico)</h3>
            <p className="mt-1 text-sm text-slate-600">
              {modalEliminar.id} · {modalEliminar.grupo_label || modalEliminar.grupo_id} · {modalEliminar.periodo || "Perpetuo"}
            </p>
            <p className="mt-2 text-xs text-rose-700">
              Acción exclusiva RRHH. Si el plan está habilitado, se desmaterializa su capa teórica y se conserva historial.
            </p>

            <textarea
              value={justificacionEliminar}
              onChange={(e) => setJustificacionEliminar(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Justificativo obligatorio (mínimo 10 caracteres)"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />

            <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmarEliminarPaso1}
                  onChange={(e) => setConfirmarEliminarPaso1(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo que corresponde eliminar este plan y que comprendo el impacto operativo.
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmarEliminarPaso2}
                  onChange={(e) => setConfirmarEliminarPaso2(e.target.checked)}
                  className="mt-0.5"
                />
                Confirmo la desmaterialización y la invalidación de overrides con trazabilidad.
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEliminar(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  operando ||
                  justificacionEliminar.trim().length < 10 ||
                  !confirmarEliminarPaso1 ||
                  !confirmarEliminarPaso2
                }
                onClick={async () => {
                  setOperando(true);
                  try {
                    const res = await callEliminarPlanTurnoServicio({
                      plan_id: modalEliminar.id,
                      motivo_eliminacion: justificacionEliminar.trim(),
                      confirmar_eliminacion: true,
                    });
                    const warns = Array.isArray(res?.data?.warnings) ? res.data.warnings : [];
                    if (warns.length > 0) {
                      showFeedback(`Plan eliminado. ${warns.map((w) => w.mensaje).join(" ")}`);
                    } else {
                      showFeedback("Plan eliminado (borrado lógico) correctamente.");
                    }
                    setModalEliminar(null);
                    setPlanDetalle(null);
                    setPlanVista(null);
                    await buscarPlanes();
                  } catch (e) {
                    setError(e?.message || "No se pudo eliminar el plan.");
                  } finally {
                    setOperando(false);
                  }
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
              >
                {operando ? "Procesando..." : "Eliminar plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
