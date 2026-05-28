import { useCallback, useMemo, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import { callListarPlanesPendientesRrhh, callAprobarPlanTurnoServicio, callRechazarPlanTurnoServicio } from "../../services/callables.js";
import BandejaAprobaciones from "../jefe/planes/BandejaAprobaciones.jsx";

export default function BandejaTurnosRrhhPage() {
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [operando, setOperando] = useState(false);
  const [filtroEstadoPend, setFiltroEstadoPend] = useState("");
  const [filtroGrupoPend, setFiltroGrupoPend] = useState("");
  const [pagePend, setPagePend] = useState(1);
  const PAGE_SIZE = 10;

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 5000);
  };

  const cargarPendientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callListarPlanesPendientesRrhh({});
      setPlanes(res.data?.items || []);
      setPagePend(1);
    } catch (e) {
      setError(e?.message || "Error al cargar planes pendientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTransicion = useCallback(async (accion, planId, extras) => {
    setOperando(true);
    setError("");
    try {
      switch (accion) {
        case "aprobar": {
          const res = await callAprobarPlanTurnoServicio({
            plan_id: planId,
            observaciones: extras?.observaciones,
            confirmar_invalidar_overrides: extras?.confirmar === true,
          });
          if (res.data?.requiere_confirmacion) {
            const ok = window.confirm(res.data.mensaje);
            if (ok) {
              await handleTransicion("aprobar", planId, { ...extras, confirmar: true });
              return;
            }
            showFeedback("Aprobación cancelada.");
            break;
          }
          showFeedback("Plan aprobado y habilitado.");
          break;
        }
        case "rechazar":
          await callRechazarPlanTurnoServicio({ plan_id: planId, observaciones: extras?.observaciones });
          showFeedback("Plan rechazado, devuelto a borrador.");
          break;
        default:
          break;
      }
      await cargarPendientes();
    } catch (e) {
      setError(e?.message || `Error en acción ${accion}.`);
    } finally {
      setOperando(false);
    }
  }, [cargarPendientes]);

  const gruposPendientes = useMemo(() => {
    const mapa = new Map();
    for (const p of planes) {
      const gid = String(p.grupo_id || "").trim();
      if (!gid || mapa.has(gid)) continue;
      mapa.set(gid, p.grupo_label || gid);
    }
    return [...mapa.entries()].map(([id, label]) => ({ id, label }));
  }, [planes]);

  const planesPendientesFiltrados = useMemo(() => {
    return planes.filter((p) => {
      if (filtroEstadoPend && p.estado !== filtroEstadoPend) return false;
      if (filtroGrupoPend && p.grupo_id !== filtroGrupoPend) return false;
      return true;
    });
  }, [planes, filtroEstadoPend, filtroGrupoPend]);

  const totalPaginasPend = Math.max(1, Math.ceil(planesPendientesFiltrados.length / PAGE_SIZE));
  const planesPendientesPagina = useMemo(() => {
    const p = Math.min(pagePend, totalPaginasPend);
    const start = (p - 1) * PAGE_SIZE;
    return planesPendientesFiltrados.slice(start, start + PAGE_SIZE);
  }, [planesPendientesFiltrados, pagePend, totalPaginasPend]);

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Bandeja de Turnos Mensuales</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
          Ambiente operativo RRHH para evaluar turnos huérfanos y planes en revisión.
        </p>
      </header>

      {feedback && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feedback}</div>}
      {error && (
        <Card className="border-red-200 bg-red-50 px-4 py-4">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError("")} className="mt-1 text-xs text-red-600 underline">Cerrar</button>
        </Card>
      )}

      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={cargarPendientes}
            disabled={loading}
            className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Cargar pendientes"}
          </button>
          <span className="text-xs text-slate-500">
            Para historial completo usá el menú `Explorador de Turnos`.
          </span>
        </div>
      </Card>

      {planes.length > 0 && (
        <Card className="px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-52">
              <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
              <select
                value={filtroEstadoPend}
                onChange={(e) => {
                  setFiltroEstadoPend(e.target.value);
                  setPagePend(1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Todos</option>
                <option value="ENVIADO">Enviado</option>
                <option value="EN_REVISION">En revisión</option>
              </select>
            </div>
            <div className="w-full sm:flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Grupo</label>
              <select
                value={filtroGrupoPend}
                onChange={(e) => {
                  setFiltroGrupoPend(e.target.value);
                  setPagePend(1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Todos los grupos</option>
                {gruposPendientes.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {!loading && planes.length === 0 && (
        <Card className="px-4 py-8 text-center">
          <p className="text-sm text-slate-500">Pulsá `Cargar pendientes` para ver turnos huérfanos a evaluar.</p>
        </Card>
      )}

      {planes.length > 0 && (
        <>
          <BandejaAprobaciones
            planes={planesPendientesPagina}
            onTransicion={handleTransicion}
            operando={operando}
            esRrhh={true}
            mostrarGrupo={true}
          />
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
            <span>Página {Math.min(pagePend, totalPaginasPend)} de {totalPaginasPend} · {planesPendientesFiltrados.length} resultado(s)</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagePend <= 1}
                onClick={() => setPagePend((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagePend >= totalPaginasPend}
                onClick={() => setPagePend((p) => Math.min(totalPaginasPend, p + 1))}
                className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
