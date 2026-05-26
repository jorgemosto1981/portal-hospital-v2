import { useCallback, useState } from "react";

import Card from "../../components/ui/Card.jsx";
import {
  callListarPlanesPendientesRrhh,
  callAprobarPlanTurnoServicio,
  callRechazarPlanTurnoServicio,
  callRevertirPlanTurnoServicio,
  callListarPlanesTurnoServicio,
} from "../../services/callables.js";
import { listarColeccionLaboral } from "../../services/datosLaboralesService.js";
import BandejaAprobaciones from "../jefe/planes/BandejaAprobaciones.jsx";

const BADGE_ESTADO = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-amber-100 text-amber-800",
  HABILITADO: "bg-green-100 text-green-800",
  CERRADO: "bg-red-100 text-red-700",
};
const LABEL_ESTADO = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  EN_REVISION: "En revisión",
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

function etiquetaGrupo(row) {
  return String(row.nombre || row.codigo || row.titulo || "").trim() || String(row.id || "");
}

export default function BandejaTurnosRrhhPage() {
  const [tab, setTab] = useState("pendientes");
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [operando, setOperando] = useState(false);

  const [grupoIdHab, setGrupoIdHab] = useState("");
  const [gruposDisponibles, setGruposDisponibles] = useState([]);
  const [gruposCargando, setGruposCargando] = useState(false);
  const [planesHabilitados, setPlanesHabilitados] = useState([]);
  const [habLoading, setHabLoading] = useState(false);

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
    } catch (e) {
      setError(e?.message || "Error al cargar planes pendientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarGrupos = useCallback(async () => {
    if (gruposDisponibles.length > 0) return;
    setGruposCargando(true);
    try {
      const rows = await listarColeccionLaboral("grupos_de_trabajo", 400);
      const activos = rows.filter((r) => r.activo !== false);
      activos.sort((a, b) => etiquetaGrupo(a).localeCompare(etiquetaGrupo(b), "es"));
      setGruposDisponibles(activos.map((r) => ({ id: r.id, label: etiquetaGrupo(r) })));
    } catch {
      // silencioso
    } finally {
      setGruposCargando(false);
    }
  }, [gruposDisponibles.length]);

  const cargarHabilitados = useCallback(async () => {
    if (!grupoIdHab) return;
    setHabLoading(true);
    try {
      const res = await callListarPlanesTurnoServicio({
        grupo_id: grupoIdHab,
        estado: "HABILITADO",
      });
      setPlanesHabilitados(res.data?.items || []);
    } catch (e) {
      setError(e?.message || "Error al cargar planes habilitados.");
    } finally {
      setHabLoading(false);
    }
  }, [grupoIdHab]);

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
        case "revertir":
          await callRevertirPlanTurnoServicio({ plan_id: planId, observaciones: extras?.observaciones });
          showFeedback("Plan revertido a revisión. Los turnos materializados se mantienen.");
          break;
        default:
          break;
      }
      await cargarPendientes();
      if (grupoIdHab) await cargarHabilitados();
    } catch (e) {
      setError(e?.message || `Error en acción ${accion}.`);
    } finally {
      setOperando(false);
    }
  }, [cargarPendientes, cargarHabilitados, grupoIdHab]);

  const TABS = [
    { id: "pendientes", label: "Pendientes (todos los grupos)" },
    { id: "revertir", label: "Revertir habilitados" },
  ];

  return (
    <div className="min-h-[calc(100dvh-6rem)] space-y-4 bg-slate-50 pb-6 md:pb-8">
      <header className="rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-sm md:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Bandeja de turnos — RRHH
        </h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-500">
          Planes de turno pendientes de aprobación (huérfanos) y revisión de planes habilitados con errores.
        </p>
      </header>

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

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "revertir") cargarGrupos();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pendientes" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cargarPendientes}
              disabled={loading}
              className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Cargar pendientes"}
            </button>
            {planes.length > 0 && (
              <p className="text-sm text-slate-500">{planes.length} plan(es) pendiente(s).</p>
            )}
          </div>

          {!loading && planes.length === 0 && (
            <Card className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">Pulsá "Cargar pendientes" para ver planes ENVIADO y EN REVISIÓN de todos los grupos.</p>
            </Card>
          )}

          {planes.length > 0 && (
            <BandejaAprobaciones
              planes={planes}
              onTransicion={handleTransicion}
              operando={operando}
              esRrhh={true}
              mostrarGrupo={true}
            />
          )}
        </div>
      )}

      {tab === "revertir" && (
        <div className="space-y-3">
          <Card className="px-4 py-3">
            <p className="mb-2 text-sm text-slate-600">
              Buscá un grupo para ver sus planes habilitados y revertir los que tengan errores.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">Grupo de trabajo</label>
                <select
                  value={grupoIdHab}
                  onChange={(e) => setGrupoIdHab(e.target.value)}
                  disabled={gruposCargando}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                >
                  <option value="">
                    {gruposCargando ? "Cargando grupos…" : "Seleccionar grupo…"}
                  </option>
                  {gruposDisponibles.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={cargarHabilitados}
                disabled={habLoading || !grupoIdHab}
                className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {habLoading ? "…" : "Buscar"}
              </button>
            </div>
          </Card>

          {!habLoading && planesHabilitados.length === 0 && grupoIdHab && (
            <Card className="px-4 py-6 text-center">
              <p className="text-sm text-slate-500">No hay planes habilitados para este grupo.</p>
            </Card>
          )}

          {planesHabilitados.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{planesHabilitados.length} plan(es) habilitado(s).</p>
              {planesHabilitados.map((plan) => (
                <Card key={plan.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{plan.id}</span>
                        <BadgeEstado estado={plan.estado} />
                      </div>
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">Tipo:</span> {plan.tipo_plan === "perpetuo" ? "Perpetuo" : "Mensual"}
                        {plan.periodo && <> — <span className="font-medium">Período:</span> {plan.periodo}</>}
                      </p>
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Agentes:</span> {plan.agentes?.length || 0}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={operando}
                      onClick={() => {
                        const obs = window.prompt("Motivo de la revisión (obligatorio):");
                        if (obs && obs.trim()) handleTransicion("revertir", plan.id, { observaciones: obs.trim() });
                      }}
                      className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      Revertir a revisión
                    </button>
                  </div>
                </Card>
              ))}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                Los turnos ya materializados seguirán vigentes hasta que se apruebe un nuevo plan corregido.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
