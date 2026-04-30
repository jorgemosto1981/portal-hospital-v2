import Card from "../../../components/ui/Card.jsx";

export default function TimelineLaboralPersonaCard({
  opcionesPersonas,
  personaId,
  onPersonaChange,
  filtro,
  onFiltroChange,
  fechaCorte,
  onFechaCorteChange,
  items,
  resumen,
  onAbrirEdicion,
  tipoTramo,
  onTipoTramoChange,
  grupoId,
  onGrupoIdChange,
  grupos,
  estadoAsignacionId,
  onEstadoAsignacionIdChange,
  estadosAsignacion,
  nivelMin,
  nivelMax,
  onNivelMinChange,
  onNivelMaxChange,
  onlySinReferencias,
  onOnlySinReferenciasChange,
  onlySolape,
  onOnlySolapeChange,
  warningTipo,
  onWarningTipoChange,
  totalBase,
  onLimpiarFiltros,
}) {
  const personaSeleccionada = opcionesPersonas.find((p) => String(p.id || "") === String(personaId || ""));
  const personaLabel = personaSeleccionada
    ? `${String(personaSeleccionada.id || "")} · ${String(personaSeleccionada.apellido || "").trim()} ${String(
        personaSeleccionada.nombre || "",
      ).trim()}`.trim()
    : String(personaId || "");
  const grupoSeleccionado = grupos.find((g) => String(g.id || "") === String(grupoId || ""));
  const grupoLabel = grupoSeleccionado
    ? `${String(grupoSeleccionado.id || "")} · ${String(grupoSeleccionado.nombre || "").trim()}`
    : String(grupoId || "");

  const chipsActivos = [];
  if (personaId) chipsActivos.push(`Persona: ${personaLabel}`);
  if (filtro && filtro !== "todos") chipsActivos.push(`Filtro: ${filtro}`);
  if ((filtro === "vigentes" || filtro === "no_vigentes") && fechaCorte) {
    chipsActivos.push(`Fecha X: ${fechaCorte}`);
  }
  if (tipoTramo && tipoTramo !== "todos") chipsActivos.push(`Tipo: ${tipoTramo}`);
  if (grupoId) chipsActivos.push(`Grupo: ${grupoLabel}`);
  if (estadoAsignacionId) chipsActivos.push(`Estado asignacion: ${estadoAsignacionId}`);
  if (nivelMin) chipsActivos.push(`Nivel min: ${nivelMin}`);
  if (nivelMax) chipsActivos.push(`Nivel max: ${nivelMax}`);
  if (onlySinReferencias) chipsActivos.push("Sin referencias");
  if (onlySolape) chipsActivos.push("Solo solapes");
  if (warningTipo && warningTipo !== "todos") chipsActivos.push(`Warning: ${warningTipo}`);

  return (
    <Card className="px-4 py-4 md:px-5">
      <p className="text-base font-semibold text-slate-900">Timeline laboral por persona</p>
      <p className="mt-1 text-sm text-slate-600">
        Vista consolidada HLc {"->"} HLd {"->"} HLg para seguimiento de vigencias y conflictos operativos.
      </p>
      <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Regla de vigencia: fechas evaluadas en modo inclusivo [fecha_desde, fecha_hasta].
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">persona_id</label>
          <select
            value={personaId}
            onChange={(e) => onPersonaChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="">Seleccionar persona...</option>
            {opcionesPersonas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre || p.apellido
                  ? `${p.id} · ${p.apellido || ""} ${p.nombre || ""}`.trim()
                  : p.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Filtro</label>
          <select
            value={filtro}
            onChange={(e) => onFiltroChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="todos">Todos</option>
            <option value="activos">Activos (hoy)</option>
            <option value="no_activos">No activos (hoy)</option>
            <option value="cerrados">Cerrados (con fecha de fin)</option>
            <option value="vigentes">Vigentes en fecha X</option>
            <option value="no_vigentes">No vigentes en fecha X</option>
            <option value="conflicto">Con conflicto</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha X</label>
          <input
            type="date"
            value={fechaCorte}
            onChange={(e) => onFechaCorteChange(e.target.value)}
            disabled={filtro !== "vigentes" && filtro !== "no_vigentes"}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipo de tramo</label>
          <select
            value={tipoTramo}
            onChange={(e) => onTipoTramoChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="todos">Todos</option>
            <option value="HLc">HLc</option>
            <option value="HLd">HLd</option>
            <option value="HLg">HLg</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Grupo</label>
          <select
            value={grupoId}
            onChange={(e) => onGrupoIdChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="">Todos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id} ({g.nombre || "sin nombre"})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Estado de asignacion</label>
          <select
            value={estadoAsignacionId}
            onChange={(e) => onEstadoAsignacionIdChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="">Todos</option>
            {estadosAsignacion.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} ({x.nombre || "sin nombre"})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel min</label>
          <input
            type="number"
            min="1"
            max="99"
            value={nivelMin}
            onChange={(e) => onNivelMinChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nivel max</label>
          <input
            type="number"
            min="1"
            max="99"
            value={nivelMax}
            onChange={(e) => onNivelMaxChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          />
        </div>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlySinReferencias}
            onChange={(e) => onOnlySinReferenciasChange(e.target.checked)}
          />
          Sin referencias
        </label>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input type="checkbox" checked={onlySolape} onChange={(e) => onOnlySolapeChange(e.target.checked)} />
          Solo solapes
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipo warning</label>
          <select
            value={warningTipo}
            onChange={(e) => onWarningTipoChange(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-600 focus:ring-2"
          >
            <option value="todos">Todos</option>
            <option value="SOLAPE_CARGO_GRUPO">Solape mismo cargo+grupo</option>
            <option value="DESVIO_CARGA_NORMATIVA">Desvío carga normativa vs operativa</option>
          </select>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onFiltroChange("activos")}
          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
        >
          Activos
        </button>
        <button
          type="button"
          onClick={() => onFiltroChange("conflicto")}
          className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
        >
          Conflicto
        </button>
        <button
          type="button"
          onClick={() => onTipoTramoChange("HLg")}
          className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
        >
          Solo HLg
        </button>
        <button
          type="button"
          onClick={onLimpiarFiltros}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Mostrando: <span className="font-semibold">{items.length}</span> / {totalBase}
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Activos (base): <span className="font-semibold">{resumen.activos}</span>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
          Cerrados (base): <span className="font-semibold">{resumen.cerrados}</span>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Conflictos (base): <span className="font-semibold">{resumen.conflictos}</span>
        </div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Warning solape cargo+grupo (base):{" "}
          <span className="font-semibold">{resumen.warningSolapeCargoGrupo || 0}</span>
        </div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Warning desvío carga normativa (base):{" "}
          <span className="font-semibold">{resumen.warningDesvioCargaNormativa || 0}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {chipsActivos.length === 0 ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
            Sin filtros activos (vista general)
          </span>
        ) : (
          chipsActivos.map((chip) => (
            <span key={chip} className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] text-indigo-700">
              {chip}
            </span>
          ))
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No hay tramos para el filtro seleccionado.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Registro</th>
                <th className="px-3 py-2">Estado operativo</th>
                <th className="px-3 py-2">Estado admin</th>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2">Hasta</th>
                <th className="px-3 py-2">Detalle</th>
                <th className="px-3 py-2">Conflictos</th>
                <th className="px-3 py-2">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {items.map((item) => (
                <tr key={`${item.tipo}-${item.id}`}>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      {item.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{item.id || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.estado === "activo"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.estado === "cerrado"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.hasta ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.hasta ? "cerrado" : "abierto"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.desde || "—"}</td>
                  <td className="px-3 py-2">{item.hasta || "—"}</td>
                  <td className="px-3 py-2">{item.secundario || "—"}</td>
                  <td className="px-3 py-2">
                    {(item.conflictos || []).length > 0 ? (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        {item.conflictos.join(" | ")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onAbrirEdicion(item)}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                      Abrir
                    </button>
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
