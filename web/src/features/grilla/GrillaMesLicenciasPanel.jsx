import { useCallback, useState } from "react";

import { useAuthClaims } from "../auth/useAuthClaims.js";
import { useAuthSession } from "../auth/useAuthSession.js";
import { claimsIncludeRrhh } from "../routing/portalRole.js";
import { callObtenerVistaGrillaMesAgente } from "../../services/callables.js";
import DiaGrillaDetalleModal from "./DiaGrillaDetalleModal.jsx";

function diasEnMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function etiquetaDia(dia, eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) return "";
  const e = eventos[0];
  return String(e.codigo_grilla || "").trim() || "·";
}

function colorDia(eventos) {
  if (!Array.isArray(eventos) || eventos.length === 0) return "#f1f5f9";
  return String(eventos[0].color_ui || "#94a3b8");
}

export default function GrillaMesLicenciasPanel() {
  const { user } = useAuthSession();
  const { claims } = useAuthClaims(user);
  const esRrhh = claimsIncludeRrhh(claims);
  const bandejaPath = esRrhh ? "/portal/rrhh/solicitudes-articulo" : "/portal/jefe/solicitudes";
  const personaDefault = String(claims?.persona_id || "").trim();

  const [diaModal, setDiaModal] = useState(null);

  const hoy = new Date();
  const [periodo, setPeriodo] = useState(
    () => `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`,
  );
  const [personaId, setPersonaId] = useState(personaDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState(null);

  const cargar = useCallback(async () => {
    const [y, m] = periodo.split("-").map((x) => Number(x));
    if (!y || !m) return;
    setLoading(true);
    setError("");
    try {
      const res = await callObtenerVistaGrillaMesAgente({
        persona_id: personaId.trim() || undefined,
        anio: y,
        mes: m,
      });
      setVista(res?.data || null);
    } catch (e) {
      setVista(null);
      setError(e?.message || "No se pudo cargar la vista mensual.");
    } finally {
      setLoading(false);
    }
  }, [periodo, personaId]);

  const [anio, mes] = periodo.split("-").map((x) => Number(x));
  const totalDias = diasEnMes(anio, mes);
  const diasMap = vista?.dias && typeof vista.dias === "object" ? vista.dias : {};

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-900">Calendario de licencias (vista mes)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Lee <code className="text-xs">vistas_grilla_mes_agente</code> generada por MDC. Sin recálculo en
        cliente.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
          placeholder="per_* (vacío = tu legajo)"
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-200 px-3 text-sm font-mono"
        />
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className="h-11 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Cargar mes"}
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      {vista && !loading ? (
        <p className="mt-2 text-xs text-slate-500">
          {vista.existe ? (
            <>
              Doc <span className="font-mono">{vista.vis_id}</span>
            </>
          ) : (
            <>Sin documento <span className="font-mono">{vista.vis_id}</span> para este mes.</>
          )}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-7 gap-1 sm:grid-cols-10 md:grid-cols-11">
        {Array.from({ length: totalDias }, (_, i) => {
          const dia = String(i + 1).padStart(2, "0");
          const cell = diasMap[dia] || {};
          const eventos = cell.eventos;
          const label = etiquetaDia(dia, eventos);
          const bg = colorDia(eventos);
          const pendiente =
            Array.isArray(eventos) &&
            eventos.some((e) => String(e.estado_solicitud_id || "").includes("revision"));
          const tieneEventos = Array.isArray(eventos) && eventos.length > 0;
          return (
            <button
              type="button"
              key={dia}
              disabled={!tieneEventos}
              onClick={() => tieneEventos && setDiaModal({ dia, eventos })}
              title={
                tieneEventos && eventos[0]
                  ? `${eventos[0].codigo_grilla || ""} · ${eventos[0].estado_solicitud_id || ""} — clic para detalle`
                  : `Día ${dia}`
              }
              className={[
                "flex min-h-[3rem] flex-col items-center justify-center rounded border text-center text-[10px] font-semibold text-slate-800",
                pendiente ? "border-dashed border-amber-400" : "border-slate-200",
                tieneEventos ? "cursor-pointer hover:ring-2 hover:ring-violet-300" : "cursor-default opacity-90",
              ].join(" ")}
              style={{ backgroundColor: label ? bg : undefined }}
            >
              <span className="text-[9px] text-slate-500">{Number(dia)}</span>
              <span className="truncate px-0.5">{label}</span>
            </button>
          );
        })}
      </div>

      <DiaGrillaDetalleModal
        open={diaModal != null}
        onClose={() => setDiaModal(null)}
        dia={diaModal?.dia ?? ""}
        eventos={diaModal?.eventos ?? []}
        bandejaPath={bandejaPath}
      />

      <p className="mt-3 text-xs text-slate-500">
        Clic en un día con licencia abre detalle y enlace a bandeja.{" "}
        <span className="inline-block h-3 w-3 rounded border border-dashed border-amber-400 align-middle" />{" "}
        borde punteado = solicitud aún en revisión · color desde MDC (#3B82F6 aprobado, #F59E0B pendiente).
      </p>
    </div>
  );
}
