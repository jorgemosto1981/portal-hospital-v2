import { useCallback, useEffect, useMemo, useState } from "react";
import { callListarContextoPlanGrupo } from "../../../services/callables.js";

const PALETA_COLORES_BASE = [
  { bg: "bg-yellow-100 hover:bg-yellow-200", text: "text-yellow-800" },
  { bg: "bg-blue-100 hover:bg-blue-200", text: "text-blue-800" },
  { bg: "bg-indigo-100 hover:bg-indigo-200", text: "text-indigo-800" },
  { bg: "bg-orange-100 hover:bg-orange-200", text: "text-orange-800" },
  { bg: "bg-emerald-100 hover:bg-emerald-200", text: "text-emerald-800" },
  { bg: "bg-pink-100 hover:bg-pink-200", text: "text-pink-800" },
  { bg: "bg-cyan-100 hover:bg-cyan-200", text: "text-cyan-800" },
  { bg: "bg-rose-100 hover:bg-rose-200", text: "text-rose-800" },
  { bg: "bg-violet-100 hover:bg-violet-200", text: "text-violet-800" },
  { bg: "bg-teal-100 hover:bg-teal-200", text: "text-teal-800" },
];
const FRANCO_STYLE = { bg: "bg-slate-200 hover:bg-slate-300", text: "text-slate-600" };
const BLOQUEADO_STYLE = { bg: "bg-slate-100", text: "text-slate-300" };
const NO_ASIGNADO_STYLE = { bg: "bg-slate-50 hover:bg-slate-100", text: "text-slate-400" };

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

/** Hard block: fecha fuera de vigencia HLG */
function esDiaEnVigenciaHlg(fechaYmd, fechaInicio, fechaFin) {
  if (fechaInicio && fechaYmd < fechaInicio) return false;
  if (fechaFin && fechaYmd > fechaFin) return false;
  return true;
}

/** Soft check: dia asignado al grupo segun regimen fijo (por dia de semana) */
function esDiaAsignadoFijo(regimen, fechaYmd) {
  if (!regimen?.dias?.length) return true;
  const date = new Date(fechaYmd + "T12:00:00");
  const dow = date.getUTCDay();
  const isoWeekday = dow === 0 ? 7 : dow;
  const diaConf = regimen.dias.find((d) => d.dia_semana === isoWeekday);
  if (!diaConf) return false;
  return diaConf.tipo_dia === "laborable" || diaConf.tipo_dia === "guardia";
}

/** Soft check: dia asignado al grupo segun regimen rotativo (modulo aritmetico) */
function esDiaAsignadoRotativo(regimen, fechaYmd, fechaAncla) {
  if (!fechaAncla || !regimen?.ciclo?.length) return true;
  const ancla = new Date(fechaAncla + "T12:00:00");
  const fecha = new Date(fechaYmd + "T12:00:00");
  const diff = Math.round((fecha.getTime() - ancla.getTime()) / 86400000);
  const cicloTotal = regimen.ciclo_total || regimen.ciclo.length;
  const posRaw = ((diff % cicloTotal) + cicloTotal) % cicloTotal;
  const posicion = posRaw + 1;
  const posConf = regimen.ciclo.find((p) => p.posicion === posicion);
  if (!posConf) return false;
  return posConf.tipo_dia === "laborable" || posConf.tipo_dia === "guardia";
}

function esDiaAsignadoAlGrupo(regimen, fechaYmd, fechaAncla) {
  if (!regimen) return true;
  if (regimen.tipo_patron === "planificado") return true;
  if (regimen.tipo_patron === "fijo") return esDiaAsignadoFijo(regimen, fechaYmd);
  if (regimen.tipo_patron === "rotativo") return esDiaAsignadoRotativo(regimen, fechaYmd, fechaAncla);
  return true;
}

function buildPaletaDinamica(regimenes) {
  const turnosUnion = new Map();
  for (const reg of Object.values(regimenes || {})) {
    for (const t of reg.turnos_disponibles || []) {
      if (!turnosUnion.has(t.turno_id)) {
        turnosUnion.set(t.turno_id, t.etiqueta || t.turno_id);
      }
    }
  }
  const paleta = {};
  let idx = 0;
  for (const [tid, label] of turnosUnion) {
    const color = PALETA_COLORES_BASE[idx % PALETA_COLORES_BASE.length];
    paleta[tid] = { ...color, label };
    idx++;
  }
  return paleta;
}

function crearGrillaLimpia(agentes, dias) {
  const grilla = {};
  for (const ag of agentes) {
    grilla[ag.persona_id] = {};
    for (const dia of dias) {
      grilla[ag.persona_id][dia.ymd] = { tipo_dia: "franco", turno_id: null };
    }
  }
  return grilla;
}

export default function GrillaMensualEditor({ plan, grupoId, periodo, guardando, onGuardar, onCerrar }) {
  const dias = useMemo(() => diasDelMes(periodo), [periodo]);

  const [contexto, setContexto] = useState(null);
  const [cargandoContexto, setCargandoContexto] = useState(false);

  const [agentes, setAgentes] = useState(() => {
    if (plan?.agentes?.length) return plan.agentes.map((a) => ({
      persona_id: a.persona_id,
      regimen_horario_id: a.regimen_horario_id,
      hlg_id: a.hlg_id,
    }));
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

  const [selAgente, setSelAgente] = useState("");
  const [paleta, setPaleta] = useState("");
  const [errLocal, setErrLocal] = useState("");

  // Cargar contexto del grupo al montar
  useEffect(() => {
    if (!grupoId) return;
    setCargandoContexto(true);
    callListarContextoPlanGrupo({ grupo_id: grupoId, periodo })
      .then((res) => setContexto(res.data || null))
      .catch((e) => setErrLocal(e?.message || "Error al cargar contexto del grupo."))
      .finally(() => setCargandoContexto(false));
  }, [grupoId, periodo]);

  const turnosPaleta = useMemo(() => {
    if (!contexto?.regimenes) return {};
    return buildPaletaDinamica(contexto.regimenes);
  }, [contexto]);

  // Seleccionar primer turno disponible como pincel por defecto
  useEffect(() => {
    const keys = Object.keys(turnosPaleta);
    if (keys.length > 0 && !paleta) setPaleta(keys[0]);
  }, [turnosPaleta, paleta]);

  const personasDisponibles = useMemo(() => {
    if (!contexto?.personas_grupo) return [];
    const yaAgregadas = new Set(agentes.map((a) => a.persona_id));
    return contexto.personas_grupo.filter((p) => !yaAgregadas.has(p.persona_id));
  }, [contexto, agentes]);

  const idxRegimenes = useMemo(() => contexto?.regimenes || {}, [contexto]);

  const agentesEnriquecidos = useMemo(() => {
    if (!contexto?.personas_grupo) return {};
    const map = {};
    for (const p of contexto.personas_grupo) map[p.persona_id] = p;
    return map;
  }, [contexto]);

  useEffect(() => {
    if (agentes.length > 0 && Object.keys(grilla).length === 0) {
      setGrilla(crearGrillaLimpia(agentes, dias));
    }
  }, [agentes, dias, grilla]);

  const agregarAgente = useCallback(() => {
    if (!selAgente) return setErrLocal("Selecciona un agente.");
    const pgData = contexto?.personas_grupo?.find((p) => p.persona_id === selAgente);
    if (!pgData) return setErrLocal("Agente no encontrado en el contexto.");
    if (agentes.some((a) => a.persona_id === selAgente)) return setErrLocal("El agente ya está en la grilla.");
    setErrLocal("");
    const ag = {
      persona_id: pgData.persona_id,
      regimen_horario_id: pgData.regimen_horario_id || "",
      hlg_id: pgData.hlg_id || "",
    };
    setAgentes((prev) => [...prev, ag]);
    setGrilla((prev) => {
      const row = {};
      for (const dia of dias) {
        row[dia.ymd] = { tipo_dia: "franco", turno_id: null };
      }
      return { ...prev, [pgData.persona_id]: row };
    });
    setSelAgente("");
  }, [selAgente, agentes, dias, contexto]);

  const agregarTodos = useCallback(() => {
    if (!personasDisponibles.length) return;
    setErrLocal("");
    const nuevos = [];
    const grillaAdds = {};
    for (const pg of personasDisponibles) {
      nuevos.push({
        persona_id: pg.persona_id,
        regimen_horario_id: pg.regimen_horario_id || "",
        hlg_id: pg.hlg_id || "",
      });
      const row = {};
      for (const dia of dias) {
        row[dia.ymd] = { tipo_dia: "franco", turno_id: null };
      }
      grillaAdds[pg.persona_id] = row;
    }
    setAgentes((prev) => [...prev, ...nuevos]);
    setGrilla((prev) => ({ ...prev, ...grillaAdds }));
  }, [personasDisponibles, dias]);

  const quitarAgente = useCallback((pid) => {
    setAgentes((prev) => prev.filter((a) => a.persona_id !== pid));
    setGrilla((prev) => {
      const copy = { ...prev };
      delete copy[pid];
      return copy;
    });
  }, []);

  const toggleCelda = useCallback((pid, ymd) => {
    const enriquecido = agentesEnriquecidos[pid];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return; // hard block
    }
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
  }, [paleta, agentesEnriquecidos]);

  const resumenAgente = useCallback((pid) => {
    const row = grilla[pid] || {};
    let trabajo = 0, francos = 0;
    for (const cel of Object.values(row)) {
      if (cel.tipo_dia === "laborable" || cel.tipo_dia === "guardia") trabajo++;
      else if (cel.tipo_dia === "franco") francos++;
    }
    return { trabajo, francos };
  }, [grilla]);

  const getCeldaEstado = useCallback((pid, ymd, cel) => {
    const enriquecido = agentesEnriquecidos[pid];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return "bloqueado";
    }
    const regimen = enriquecido ? idxRegimenes[enriquecido.regimen_horario_id] : null;
    const asignado = esDiaAsignadoAlGrupo(regimen, ymd, enriquecido?.regimen_fecha_ancla);
    const esFranco = cel?.tipo_dia === "franco" || cel?.tipo_dia === "no_laborable";
    if (!asignado && !esFranco && cel?.turno_id) return "excepcion";
    if (!asignado) return "no_asignado";
    return "normal";
  }, [agentesEnriquecidos, idxRegimenes]);

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

  const labelAgente = (pid) => {
    const e = agentesEnriquecidos[pid];
    return e?.persona_label || pid;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2" onClick={onCerrar}>
      <div className="flex max-h-[92vh] w-full max-w-[95vw] flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {plan ? "Editar plan mensual" : "Nuevo plan mensual"}
            </h2>
            <p className="text-sm text-slate-500">Periodo: {periodo} — Grupo: {grupoId}</p>
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {cargandoContexto && (
          <div className="px-5 py-3 text-sm text-slate-500">Cargando contexto del grupo...</div>
        )}

        {/* Paleta dinamica de turnos */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2">
          <span className="text-xs font-medium text-slate-500">Pincel:</span>
          {Object.entries(turnosPaleta).map(([key, style]) => (
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
            {paleta === "F" ? "Franco" : turnosPaleta[paleta]?.label || paleta}
          </span>
        </div>

        {/* Agregar agente con select dinamico */}
        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-2">
          <div className="flex-1">
            <label className="mb-0.5 block text-xs text-slate-500">Seleccionar agente</label>
            <select
              value={selAgente}
              onChange={(e) => setSelAgente(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
              disabled={!personasDisponibles.length}
            >
              <option value="">— Seleccionar —</option>
              {personasDisponibles.map((p) => (
                <option key={p.persona_id} value={p.persona_id}>
                  {p.persona_label || p.persona_id} {p.persona_dni ? `(${p.persona_dni})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={agregarAgente}
            disabled={!selAgente}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            + Agregar
          </button>
          {personasDisponibles.length > 0 && (
            <button
              type="button"
              onClick={agregarTodos}
              className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
            >
              + Todos ({personasDisponibles.length})
            </button>
          )}
        </div>

        {errLocal && (
          <div className="mx-5 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {errLocal}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-1.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-white border border-slate-200"></span> Asignado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-50 border border-slate-200"></span> No asignado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-100 border border-slate-200" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)" }}></span> Fuera vigencia</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-orange-400 bg-yellow-100"></span> Excepcion</span>
        </div>

        {/* Grilla */}
        <div className="flex-1 overflow-auto px-2 py-3">
          {agentes.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              {cargandoContexto ? "Cargando..." : "Agrega agentes para comenzar a armar la grilla."}
            </div>
          ) : (
            <table className="min-w-max border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[180px] bg-white px-2 py-1 text-left text-xs font-semibold text-slate-500">
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
                        <span className="text-xs text-slate-700">{labelAgente(ag.persona_id)}</span>
                      </td>
                      {dias.map((dia) => {
                        const cel = grilla[ag.persona_id]?.[dia.ymd];
                        const estado = getCeldaEstado(ag.persona_id, dia.ymd, cel);
                        const esFranco = cel?.tipo_dia === "franco" || cel?.tipo_dia === "no_laborable";
                        const turno = cel?.turno_id || "";

                        if (estado === "bloqueado") {
                          return (
                            <td key={dia.ymd} className="px-0.5 py-0.5">
                              <div
                                className={`flex h-6 w-7 items-center justify-center rounded text-[10px] ${BLOQUEADO_STYLE.bg} ${BLOQUEADO_STYLE.text}`}
                                style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)" }}
                                title={`${dia.ymd} — Fuera de vigencia HLG`}
                              >
                                —
                              </div>
                            </td>
                          );
                        }

                        let style;
                        let extraClass = "";
                        if (esFranco) {
                          style = estado === "no_asignado" ? NO_ASIGNADO_STYLE : FRANCO_STYLE;
                        } else {
                          style = turnosPaleta[turno] || { bg: "bg-green-100 hover:bg-green-200", text: "text-green-700" };
                        }
                        if (estado === "excepcion") {
                          extraClass = "ring-2 ring-orange-400 ring-offset-1";
                        }
                        if (estado === "no_asignado" && esFranco) {
                          style = NO_ASIGNADO_STYLE;
                        }

                        const tooltipParts = [dia.ymd];
                        if (estado === "excepcion") tooltipParts.push("(dia no asignado al grupo)");
                        if (estado === "no_asignado") tooltipParts.push("(no asignado)");
                        tooltipParts.push(esFranco ? "Franco" : turno);

                        return (
                          <td key={dia.ymd} className="px-0.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => toggleCelda(ag.persona_id, dia.ymd)}
                              className={`flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold transition ${style.bg} ${style.text} ${extraClass}`}
                              title={tooltipParts.join(" ")}
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
            {guardando ? "Guardando..." : "Guardar borrador"}
          </button>
        </div>
      </div>
    </div>
  );
}
