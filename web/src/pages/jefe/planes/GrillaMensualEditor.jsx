import { useCallback, useEffect, useMemo, useState } from "react";

const TURNOS_COLOR = {
  M: { bg: "bg-yellow-100 hover:bg-yellow-200", text: "text-yellow-800", label: "Mañana" },
  T: { bg: "bg-blue-100 hover:bg-blue-200", text: "text-blue-800", label: "Tarde" },
  N: { bg: "bg-indigo-100 hover:bg-indigo-200", text: "text-indigo-800", label: "Noche" },
  G: { bg: "bg-orange-100 hover:bg-orange-200", text: "text-orange-800", label: "Guardia" },
};
const FRANCO_STYLE = { bg: "bg-slate-200 hover:bg-slate-300", text: "text-slate-600" };
const OPCIONES_TIPO_DIA = ["laborable", "guardia", "franco", "no_laborable"];

function diasDelMes(periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  const total = new Date(anio, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= total; d++) {
    const ymd = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(anio, mes - 1, d).getDay();
    dias.push({ ymd, d, dow, esFinde: dow === 0 || dow === 6 });
  }
  return dias;
}

const DOW_LABELS = ["D", "L", "M", "X", "J", "V", "S"];

function crearGrillaVacia(agentes, dias) {
  const grilla = {};
  for (const ag of agentes) {
    grilla[ag.persona_id] = {};
    for (const dia of dias) {
      grilla[ag.persona_id][dia.ymd] = { tipo_dia: dia.esFinde ? "franco" : "laborable", turno_id: dia.esFinde ? null : "M" };
    }
  }
  return grilla;
}

export default function GrillaMensualEditor({ plan, grupoId, periodo, guardando, onGuardar, onCerrar }) {
  const dias = useMemo(() => diasDelMes(periodo), [periodo]);

  const [agentes, setAgentes] = useState(() => {
    if (plan?.agentes?.length) return plan.agentes.map((a) => ({ persona_id: a.persona_id, regimen_horario_id: a.regimen_horario_id, hlg_id: a.hlg_id }));
    return [];
  });

  const [grilla, setGrilla] = useState(() => {
    if (plan?.agentes?.length) {
      const g = {};
      for (const ag of plan.agentes) g[ag.persona_id] = ag.dias || {};
      return g;
    }
    return {};
  });

  const [nuevoAgente, setNuevoAgente] = useState({ persona_id: "", regimen_horario_id: "", hlg_id: "" });
  const [paleta, setPaleta] = useState("M");
  const [errLocal, setErrLocal] = useState("");

  useEffect(() => {
    if (agentes.length > 0 && Object.keys(grilla).length === 0) {
      setGrilla(crearGrillaVacia(agentes, dias));
    }
  }, [agentes, dias, grilla]);

  const agregarAgente = useCallback(() => {
    const pid = nuevoAgente.persona_id.trim();
    const rid = nuevoAgente.regimen_horario_id.trim();
    const hid = nuevoAgente.hlg_id.trim();
    if (!pid || !rid || !hid) return setErrLocal("Todos los campos del agente son obligatorios.");
    if (agentes.some((a) => a.persona_id === pid)) return setErrLocal("El agente ya está en la grilla.");
    setErrLocal("");
    const ag = { persona_id: pid, regimen_horario_id: rid, hlg_id: hid };
    setAgentes((prev) => [...prev, ag]);
    setGrilla((prev) => {
      const row = {};
      for (const dia of dias) {
        row[dia.ymd] = { tipo_dia: dia.esFinde ? "franco" : "laborable", turno_id: dia.esFinde ? null : "M" };
      }
      return { ...prev, [pid]: row };
    });
    setNuevoAgente({ persona_id: "", regimen_horario_id: "", hlg_id: "" });
  }, [nuevoAgente, agentes, dias]);

  const quitarAgente = useCallback((pid) => {
    setAgentes((prev) => prev.filter((a) => a.persona_id !== pid));
    setGrilla((prev) => {
      const copy = { ...prev };
      delete copy[pid];
      return copy;
    });
  }, []);

  const toggleCelda = useCallback((pid, ymd) => {
    setGrilla((prev) => {
      const celda = prev[pid]?.[ymd];
      if (!celda) return prev;
      let nueva;
      if (paleta === "F") {
        nueva = { tipo_dia: "franco", turno_id: null };
      } else {
        nueva = { tipo_dia: "laborable", turno_id: paleta };
      }
      return { ...prev, [pid]: { ...prev[pid], [ymd]: nueva } };
    });
  }, [paleta]);

  const resumenAgente = useCallback((pid) => {
    const row = grilla[pid] || {};
    let trabajo = 0, francos = 0;
    for (const cel of Object.values(row)) {
      if (cel.tipo_dia === "laborable" || cel.tipo_dia === "guardia") trabajo++;
      else if (cel.tipo_dia === "franco") francos++;
    }
    return { trabajo, francos };
  }, [grilla]);

  const handleGuardar = useCallback(() => {
    if (agentes.length === 0) return setErrLocal("Agrega al menos un agente.");
    setErrLocal("");
    const datos = {
      grupo_id: grupoId,
      tipo_plan: "mensual",
      periodo,
      agentes: agentes.map((ag) => ({
        persona_id: ag.persona_id,
        regimen_horario_id: ag.regimen_horario_id,
        hlg_id: ag.hlg_id,
        dias: grilla[ag.persona_id] || {},
      })),
    };
    onGuardar(datos, plan?.id || null);
  }, [agentes, grilla, grupoId, periodo, plan, onGuardar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2" onClick={onCerrar}>
      <div className="flex max-h-[92vh] w-full max-w-[95vw] flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {plan ? "Editar plan mensual" : "Nuevo plan mensual"}
            </h2>
            <p className="text-sm text-slate-500">Período: {periodo} — Grupo: {grupoId}</p>
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Paleta de turnos */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-2">
          <span className="text-xs font-medium text-slate-500">Pincel:</span>
          {Object.entries(TURNOS_COLOR).map(([key, style]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPaleta(key)}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${style.bg} ${style.text} ${
                paleta === key ? "ring-2 ring-indigo-400 ring-offset-1" : ""
              }`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPaleta("F")}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition ${FRANCO_STYLE.bg} ${FRANCO_STYLE.text} ${
              paleta === "F" ? "ring-2 ring-indigo-400 ring-offset-1" : ""
            }`}
          >
            F
          </button>
          <span className="ml-3 text-xs text-slate-400">
            {paleta === "F" ? "Franco" : TURNOS_COLOR[paleta]?.label || paleta}
          </span>
        </div>

        {/* Agregar agente */}
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-2">
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">persona_id</label>
            <input
              type="text"
              value={nuevoAgente.persona_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, persona_id: e.target.value }))}
              className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              placeholder="PER_…"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">regimen_id</label>
            <input
              type="text"
              value={nuevoAgente.regimen_horario_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, regimen_horario_id: e.target.value }))}
              className="w-44 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              placeholder="CFG_REG_HOR_…"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">hlg_id</label>
            <input
              type="text"
              value={nuevoAgente.hlg_id}
              onChange={(e) => setNuevoAgente((p) => ({ ...p, hlg_id: e.target.value }))}
              className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              placeholder="hlg_…"
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
          <div className="mx-5 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {errLocal}
          </div>
        )}

        {/* Grilla */}
        <div className="flex-1 overflow-auto px-2 py-3">
          {agentes.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              Agrega agentes para comenzar a armar la grilla.
            </div>
          ) : (
            <table className="min-w-max border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[140px] bg-white px-2 py-1 text-left text-xs font-semibold text-slate-500">
                    Agente
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.ymd}
                      className={`min-w-[28px] px-0.5 py-1 text-center font-medium ${
                        dia.esFinde ? "text-red-400" : "text-slate-400"
                      }`}
                    >
                      <div>{DOW_LABELS[dia.dow]}</div>
                      <div className="text-[10px]">{dia.d}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1 text-center text-xs font-semibold text-slate-500">Trab</th>
                  <th className="px-2 py-1 text-center text-xs font-semibold text-slate-500">Franc</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {agentes.map((ag) => {
                  const res = resumenAgente(ag.persona_id);
                  return (
                    <tr key={ag.persona_id} className="group">
                      <td className="sticky left-0 z-10 bg-white px-2 py-0.5">
                        <span className="font-mono text-xs text-slate-700">{ag.persona_id}</span>
                      </td>
                      {dias.map((dia) => {
                        const cel = grilla[ag.persona_id]?.[dia.ymd];
                        const esFranco = cel?.tipo_dia === "franco" || cel?.tipo_dia === "no_laborable";
                        const turno = cel?.turno_id || "";
                        const style = esFranco ? FRANCO_STYLE : (TURNOS_COLOR[turno] || { bg: "bg-green-100 hover:bg-green-200", text: "text-green-700" });
                        return (
                          <td key={dia.ymd} className="px-0.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => toggleCelda(ag.persona_id, dia.ymd)}
                              className={`flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold transition ${style.bg} ${style.text}`}
                              title={`${dia.ymd} — ${esFranco ? "Franco" : turno}`}
                            >
                              {esFranco ? "F" : turno}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-0.5 text-center font-semibold text-slate-700">{res.trabajo}</td>
                      <td className="px-2 py-0.5 text-center font-semibold text-slate-500">{res.francos}</td>
                      <td className="px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => quitarAgente(ag.persona_id)}
                          className="rounded p-0.5 text-red-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          title="Quitar agente"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
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
