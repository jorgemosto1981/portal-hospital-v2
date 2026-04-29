import Card from "../../../components/ui/Card.jsx";
import { useMemo, useState } from "react";

export default function VistaOperativaGrupoCard({
  grupos,
  grupoId,
  onGrupoIdChange,
  fechaCorte,
  onFechaCorteChange,
  items,
}) {
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [personaQuery, setPersonaQuery] = useState("");
  const [nivelMin, setNivelMin] = useState("");
  const [nivelMax, setNivelMax] = useState("");
  const [warningTipo, setWarningTipo] = useState("todos");

  const itemsFiltrados = useMemo(() => {
    const q = String(personaQuery || "").trim().toLowerCase();
    const min = Number.isFinite(Number(nivelMin)) ? Number(nivelMin) : null;
    const max = Number.isFinite(Number(nivelMax)) ? Number(nivelMax) : null;

    return (items || []).filter((item) => {
      if (filtroEstado === "activos" && !item.activo_en_fecha) return false;
      if (filtroEstado === "no_vigentes" && item.activo_en_fecha) return false;
      if (filtroEstado === "cerrados" && item.fecha_fin === "—") return false;

      if (q) {
        const persona = String(item.persona_label || "").toLowerCase();
        const personaId = String(item.persona_id || "").toLowerCase();
        if (!persona.includes(q) && !personaId.includes(q)) return false;
      }

      if (min != null) {
        if (!Number.isFinite(Number(item.nivel_jerarquico)) || Number(item.nivel_jerarquico) < min) {
          return false;
        }
      }
      if (max != null) {
        if (!Number.isFinite(Number(item.nivel_jerarquico)) || Number(item.nivel_jerarquico) > max) {
          return false;
        }
      }
      if (warningTipo !== "todos") {
        const codes = Array.isArray(item.warning_codes) ? item.warning_codes : [];
        if (!codes.includes(warningTipo)) return false;
      }
      return true;
    });
  }, [items, filtroEstado, personaQuery, nivelMin, nivelMax, warningTipo]);

  const activos = itemsFiltrados.filter((x) => x.activo_en_fecha).length;
  const noVigentes = itemsFiltrados.length - activos;
  const chipsActivos = [];
  if (grupoId) chipsActivos.push(`Grupo: ${grupoId}`);
  if (fechaCorte) chipsActivos.push(`Fecha corte: ${fechaCorte}`);
  if (filtroEstado !== "todos") chipsActivos.push(`Estado HLg: ${filtroEstado}`);
  if (personaQuery) chipsActivos.push(`Persona: ${personaQuery}`);
  if (nivelMin) chipsActivos.push(`Nivel min: ${nivelMin}`);
  if (nivelMax) chipsActivos.push(`Nivel max: ${nivelMax}`);
  if (warningTipo !== "todos") chipsActivos.push(`Warning: ${warningTipo}`);
  const warningSolape = itemsFiltrados.filter((x) =>
    (x.warning_codes || []).includes("SOLAPE_CARGO_GRUPO"),
  ).length;
  const warningDesvio = itemsFiltrados.filter((x) =>
    (x.warning_codes || []).includes("DESVIO_CARGA_NORMATIVA"),
  ).length;

  return (
    <Card className="px-4 py-4 md:px-5">
      <p className="text-base font-semibold text-slate-900">Vista operativa por grupo (burbuja)</p>
      <p className="mt-1 text-sm text-slate-600">
        Ordenada por nivel jerarquico (1..99) para revisar estructura activa y vigencia por fecha.
      </p>
      <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Regla de vigencia: fechas evaluadas en modo inclusivo [fecha_desde, fecha_hasta].
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">grupo_de_trabajo_id</label>
          <select
            value={grupoId}
            onChange={(e) => onGrupoIdChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="">Todos los grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id} ({g.nombre || "sin nombre"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha de corte</label>
          <input
            type="date"
            value={fechaCorte}
            onChange={(e) => onFechaCorteChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Estado HLg</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos en fecha</option>
            <option value="no_vigentes">No vigentes en fecha</option>
            <option value="cerrados">Cerrados (con fecha fin)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Persona (id/nombre)</label>
          <input
            value={personaQuery}
            onChange={(e) => setPersonaQuery(e.target.value)}
            placeholder="per_... o apellido"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel min</label>
          <input
            type="number"
            min="1"
            max="99"
            value={nivelMin}
            onChange={(e) => setNivelMin(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel max</label>
          <input
            type="number"
            min="1"
            max="99"
            value={nivelMax}
            onChange={(e) => setNivelMax(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipo warning</label>
          <select
            value={warningTipo}
            onChange={(e) => setWarningTipo(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="todos">Todos</option>
            <option value="SOLAPE_CARGO_GRUPO">Solape mismo cargo+grupo</option>
            <option value="DESVIO_CARGA_NORMATIVA">Desvío carga normativa vs operativa</option>
          </select>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Mostrando HLg: <span className="font-semibold">{itemsFiltrados.length}</span> /{" "}
          {(items || []).length}
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Activos en fecha: <span className="font-semibold">{activos}</span>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
          No vigentes: <span className="font-semibold">{noVigentes}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Warnings solape cargo+grupo: <span className="font-semibold">{warningSolape}</span>
        </div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Warnings desvío carga: <span className="font-semibold">{warningDesvio}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {chipsActivos.length === 0 ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            Sin filtros activos (todos los grupos)
          </span>
        ) : (
          chipsActivos.map((chip) => (
            <span key={chip} className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] text-indigo-700">
              {chip}
            </span>
          ))
        )}
      </div>

      {itemsFiltrados.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No hay asignaciones HLg para el criterio de grupo y filtros seleccionados.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">HLg ID</th>
                <th className="px-3 py-2">Persona</th>
                <th className="px-3 py-2">Nivel</th>
                <th className="px-3 py-2">Estado en fecha</th>
                <th className="px-3 py-2">Estado admin</th>
                <th className="px-3 py-2">Dato laboral</th>
                <th className="px-3 py-2">Cargo</th>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2">Hasta</th>
                <th className="px-3 py-2">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {itemsFiltrados.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-mono">{item.id}</td>
                  <td className="px-3 py-2">{item.persona_label}</td>
                  <td className="px-3 py-2">{item.nivel_jerarquico ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.activo_en_fecha
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.activo_en_fecha ? "activo" : "no vigente"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.fecha_fin !== "—"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.fecha_fin !== "—" ? "cerrado" : "abierto"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{item.dato_laboral_id || "—"}</td>
                  <td className="px-3 py-2 font-mono">{item.cargo_id || "—"}</td>
                  <td className="px-3 py-2">{item.fecha_inicio}</td>
                  <td className="px-3 py-2">{item.fecha_fin}</td>
                  <td className="px-3 py-2">
                    {(item.conflictos || []).length > 0 ? (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        {item.conflictos.join(" | ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
