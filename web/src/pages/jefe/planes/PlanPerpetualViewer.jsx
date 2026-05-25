import { useCallback, useState } from "react";

export default function PlanPerpetualViewer({ plan, grupoId, guardando, onGuardar, onCerrar }) {
  const [agentes, setAgentes] = useState(() => {
    if (plan?.agentes?.length) return plan.agentes.map((a) => ({
      persona_id: a.persona_id,
      regimen_horario_id: a.regimen_horario_id,
      hlg_id: a.hlg_id,
      regimen_fecha_ancla: a.regimen_fecha_ancla || "",
    }));
    return [];
  });
  const [vigente_desde, setVigenteDesde] = useState(plan?.vigente_desde || new Date().toISOString().slice(0, 10));
  const [vigente_hasta, setVigenteHasta] = useState(plan?.vigente_hasta || "");
  const [nuevoAgente, setNuevoAgente] = useState({ persona_id: "", regimen_horario_id: "", hlg_id: "", regimen_fecha_ancla: "" });
  const [errLocal, setErrLocal] = useState("");

  const agregarAgente = useCallback(() => {
    const pid = nuevoAgente.persona_id.trim();
    const rid = nuevoAgente.regimen_horario_id.trim();
    const hid = nuevoAgente.hlg_id.trim();
    if (!pid || !rid || !hid) return setErrLocal("persona_id, regimen_id y hlg_id son obligatorios.");
    if (agentes.some((a) => a.persona_id === pid)) return setErrLocal("El agente ya existe.");
    setErrLocal("");
    setAgentes((prev) => [...prev, { ...nuevoAgente, persona_id: pid, regimen_horario_id: rid, hlg_id: hid }]);
    setNuevoAgente({ persona_id: "", regimen_horario_id: "", hlg_id: "", regimen_fecha_ancla: "" });
  }, [nuevoAgente, agentes]);

  const quitarAgente = useCallback((pid) => {
    setAgentes((prev) => prev.filter((a) => a.persona_id !== pid));
  }, []);

  const handleGuardar = useCallback(() => {
    if (agentes.length === 0) return setErrLocal("Agrega al menos un agente.");
    if (!vigente_desde) return setErrLocal("Vigente desde es obligatorio.");
    setErrLocal("");
    const datos = {
      grupo_id: grupoId,
      tipo_plan: "perpetuo",
      vigente_desde,
      vigente_hasta: vigente_hasta || null,
      agentes: agentes.map((a) => ({
        persona_id: a.persona_id,
        regimen_horario_id: a.regimen_horario_id,
        hlg_id: a.hlg_id,
        regimen_fecha_ancla: a.regimen_fecha_ancla || null,
      })),
    };
    onGuardar(datos, plan?.id || null);
  }, [agentes, vigente_desde, vigente_hasta, grupoId, plan, onGuardar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {plan ? "Editar plan perpetuo" : "Nuevo plan perpetuo"}
            </h2>
            <p className="text-sm text-slate-500">Grupo: {grupoId}</p>
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Vigencia */}
        <div className="mb-4 flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Vigente desde</label>
            <input
              type="date"
              value={vigente_desde}
              onChange={(e) => setVigenteDesde(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Vigente hasta (vacío = sin fin)</label>
            <input
              type="date"
              value={vigente_hasta}
              onChange={(e) => setVigenteHasta(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Lista agentes */}
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Agentes</h3>
        {agentes.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">persona_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">regimen_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">hlg_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-500">fecha_ancla</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentes.map((ag) => (
                  <tr key={ag.persona_id}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-700">{ag.persona_id}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{ag.regimen_horario_id}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{ag.hlg_id}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{ag.regimen_fecha_ancla || "—"}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => quitarAgente(ag.persona_id)}
                        className="rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Agregar agente */}
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">persona_id</label>
            <input
              type="text"
              value={nuevoAgente.persona_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, persona_id: e.target.value }))}
              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">regimen_id</label>
            <input
              type="text"
              value={nuevoAgente.regimen_horario_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, regimen_horario_id: e.target.value }))}
              className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">hlg_id</label>
            <input
              type="text"
              value={nuevoAgente.hlg_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, hlg_id: e.target.value }))}
              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">fecha_ancla</label>
            <input
              type="date"
              value={nuevoAgente.regimen_fecha_ancla}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, regimen_fecha_ancla: e.target.value }))}
              className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <button
            type="button"
            onClick={agregarAgente}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            + Agregar
          </button>
        </div>

        {errLocal && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {errLocal}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || agentes.length === 0}
            onClick={handleGuardar}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar borrador"}
          </button>
        </div>
      </div>
    </div>
  );
}
