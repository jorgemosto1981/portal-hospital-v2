import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callListarContextoPlanGrupo, callListarPlanesTurnoServicio } from "../../../services/callables.js";
import {
  esRegimenDerivado,
  esRegimenPlanificado,
  generarGrillaDesdeRegimen,
  labelTipoRegimen,
} from "./planGrillaRegimenUtils.js";

const PALETA_COLORES_BASE = [
  { bg: "bg-yellow-300 hover:bg-yellow-400", text: "text-yellow-950" },
  { bg: "bg-blue-300 hover:bg-blue-400", text: "text-blue-950" },
  { bg: "bg-indigo-300 hover:bg-indigo-400", text: "text-indigo-950" },
  { bg: "bg-orange-300 hover:bg-orange-400", text: "text-orange-950" },
  { bg: "bg-emerald-300 hover:bg-emerald-400", text: "text-emerald-950" },
  { bg: "bg-pink-300 hover:bg-pink-400", text: "text-pink-950" },
  { bg: "bg-cyan-300 hover:bg-cyan-400", text: "text-cyan-950" },
  { bg: "bg-rose-300 hover:bg-rose-400", text: "text-rose-950" },
  { bg: "bg-violet-300 hover:bg-violet-400", text: "text-violet-950" },
  { bg: "bg-teal-300 hover:bg-teal-400", text: "text-teal-950" },
];
const FRANCO_STYLE = { bg: "bg-slate-400 hover:bg-slate-500", text: "text-slate-900" };
const NO_LABORABLE_STYLE = { bg: "bg-slate-200 hover:bg-slate-300", text: "text-slate-700" };
const BLOQUEADO_STYLE = { bg: "bg-slate-100", text: "text-slate-300" };
const NO_ASIGNADO_STYLE = { bg: "bg-slate-400 hover:bg-slate-500", text: "text-slate-900" };
const LICENCIA_STYLE = { bg: "bg-fuchsia-300", text: "text-fuchsia-950" };
const INSTITUCIONAL_STYLE = { bg: "bg-amber-300", text: "text-amber-950" };

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

function normalizarTipoDiaCelda(tipoDiaRaw) {
  const t = String(tipoDiaRaw || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "laborable" || t === "guardia" || t === "franco" || t === "no_laborable") return t;
  if (t === "no-laborable" || t === "nolaborable" || t === "no_laboral") return "no_laborable";
  return "franco";
}

function horarioIngresoEgreso(turno = {}) {
  const ingreso = String(turno.ingreso || turno.hora_ingreso || turno.h_ingreso || turno.desde || "").trim();
  const egreso = String(turno.egreso || turno.hora_egreso || turno.h_egreso || turno.hasta || "").trim();
  const compactarHora = (horaTxt) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(horaTxt || "").trim());
    if (!m) return null;
    const hh = String(Number(m[1])).padStart(2, "0");
    const mm = m[2];
    return { hh, mm };
  };
  if (ingreso && egreso) {
    const hi = compactarHora(ingreso);
    const he = compactarHora(egreso);
    if (hi && he && hi.mm === "00" && he.mm === "00") {
      return `${hi.hh}-${he.hh}`;
    }
    return `${ingreso}-${egreso}`;
  }
  if (ingreso) return ingreso;
  if (egreso) return egreso;
  return "";
}

function horarioDerivadoPorDia(regimen, ymd, fechaAncla) {
  if (!regimen || !ymd) return "";
  if (regimen.tipo_patron === "fijo") {
    const date = new Date(`${ymd}T12:00:00`);
    const dow = date.getUTCDay();
    const isoWeekday = dow === 0 ? 7 : dow;
    const diaConf = (regimen.dias || []).find((d) => d.dia_semana === isoWeekday);
    if (!diaConf || (diaConf.tipo_dia !== "laborable" && diaConf.tipo_dia !== "guardia")) return "";
    return horarioIngresoEgreso(diaConf.turno || diaConf);
  }
  if (regimen.tipo_patron === "rotativo") {
    if (!fechaAncla || !regimen?.ciclo?.length) return "";
    const ancla = new Date(`${fechaAncla}T12:00:00`);
    const fecha = new Date(`${ymd}T12:00:00`);
    const diff = Math.round((fecha.getTime() - ancla.getTime()) / 86400000);
    const cicloTotal = regimen.ciclo_total || regimen.ciclo.length;
    const posRaw = ((diff % cicloTotal) + cicloTotal) % cicloTotal;
    const posicion = posRaw + 1;
    const posConf = regimen.ciclo.find((p) => p.posicion === posicion);
    if (!posConf || (posConf.tipo_dia !== "laborable" && posConf.tipo_dia !== "guardia")) return "";
    return horarioIngresoEgreso(posConf.turno || posConf);
  }
  return "";
}

function horarioPlanificadoPorTurno(regimen, turnoId) {
  const tid = String(turnoId || "").trim();
  if (!regimen || !tid) return "";
  const turno = (regimen.turnos_disponibles || []).find(
    (t) => String(t?.turno_id || t?.id || "").trim() === tid,
  );
  if (!turno) return "";
  return horarioIngresoEgreso(turno);
}

function obtenerLicenciasDia(contexto, personaId, ymd) {
  const mapPersona = contexto?.licencias_por_persona_ymd?.[personaId];
  const eventos = mapPersona?.[ymd];
  return Array.isArray(eventos) ? eventos : [];
}

function valorHorario(turno = {}) {
  const ingreso =
    String(turno.ingreso || turno.hora_ingreso || turno.h_ingreso || turno.desde || "").trim() || null;
  const egreso =
    String(turno.egreso || turno.hora_egreso || turno.h_egreso || turno.hasta || "").trim() || null;
  if (ingreso && egreso) return `${ingreso}-${egreso}`;
  if (ingreso) return ingreso;
  if (egreso) return egreso;
  return "";
}

function resumenRegimenTurnos(regimen) {
  if (!regimen || typeof regimen !== "object") return "Sin detalle de turnos";
  const acc = new Map();
  const pushTurno = (turnoObj) => {
    const tid = String(turnoObj?.turno_id || turnoObj?.id || "").trim();
    if (!tid) return;
    const etiqueta = String(turnoObj?.etiqueta || tid).trim();
    const horario = valorHorario(turnoObj);
    const key = `${etiqueta}|${horario}`;
    if (!acc.has(key)) acc.set(key, horario ? `${etiqueta} ${horario}` : etiqueta);
  };
  (regimen.turnos_disponibles || []).forEach(pushTurno);
  (regimen.dias || []).forEach((d) => d?.turno && pushTurno(d.turno));
  (regimen.ciclo || []).forEach((c) => c?.turno && pushTurno(c.turno));
  const list = [...acc.values()];
  if (list.length === 0) return "Sin detalle de turnos";
  return list.slice(0, 3).join(" · ");
}

function detalleHorariosRegimen(regimen) {
  if (!regimen || typeof regimen !== "object") return "Sin detalle de turnos";
  const tipo = String(regimen.tipo_patron || "").toLowerCase();
  const horarios = [];
  const horariosSet = new Set();
  const addHorario = (source) => {
    const h = valorHorario(source);
    if (!h || horariosSet.has(h)) return;
    horariosSet.add(h);
    horarios.push(h);
  };
  const turnosPlanificados = [];
  const turnosPlanificadosSet = new Set();
  const addTurnoPlanificado = (turno) => {
    const etiqueta = String(turno?.etiqueta || turno?.turno_id || turno?.id || "").trim();
    if (!etiqueta) return;
    const h = valorHorario(turno);
    const row = h ? `${etiqueta} ${h}` : etiqueta;
    if (turnosPlanificadosSet.has(row)) return;
    turnosPlanificadosSet.add(row);
    turnosPlanificados.push(row);
  };
  if (tipo === "fijo") {
    (regimen.dias || []).forEach((d) => {
      if (d?.turno) addHorario(d.turno);
      addHorario(d);
    });
    (regimen.turnos_disponibles || []).forEach(addHorario);
    return horarios.length ? horarios.join(" · ") : "Sin horario fijo";
  }
  if (tipo === "rotativo") {
    (regimen.ciclo || []).forEach((c) => {
      if (c?.turno) addHorario(c.turno);
      addHorario(c);
    });
    (regimen.turnos_disponibles || []).forEach(addHorario);
    return horarios.length ? horarios.join(" · ") : "Sin horario rotativo";
  }
  if (tipo === "planificado") {
    (regimen.turnos_disponibles || []).forEach(addTurnoPlanificado);
    if (turnosPlanificados.length === 0) return "Sin turnos planificados";
    const visibles = turnosPlanificados.slice(0, 2);
    const restantes = turnosPlanificados.length - visibles.length;
    return `${turnosPlanificados.length} turnos: ${visibles.join(" · ")}${
      restantes > 0 ? ` · +${restantes}` : ""
    }`;
  }
  return resumenRegimenTurnos(regimen);
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

function normalizarFilaDias(fila, dias) {
  const base = {};
  for (const dia of dias) {
    base[dia.ymd] = { tipo_dia: "franco", turno_id: null };
  }
  if (!fila || typeof fila !== "object") return base;
  for (const dia of dias) {
    const actual = fila[dia.ymd];
    if (!actual || typeof actual !== "object") continue;
    base[dia.ymd] = {
      tipo_dia: actual.tipo_dia || "franco",
      turno_id: actual.turno_id || null,
    };
  }
  return base;
}

function clasesTextoCelda(valor) {
  const len = String(valor || "").trim().length;
  if (len <= 5) return "text-[10px]";
  if (len <= 9) return "text-[9px]";
  if (len <= 13) return "text-[8px]";
  return "text-[7px]";
}

export default function GrillaMensualEditor({
  plan,
  grupoId,
  grupoLabel,
  periodo,
  guardando,
  errorGuardar,
  onGuardar,
  onCerrar,
}) {
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

  const [paleta, setPaleta] = useState("");
  const [altoContraste, setAltoContraste] = useState(false);
  const [errLocal, setErrLocal] = useState("");
  const [comentariosJefe, setComentariosJefe] = useState(() =>
    typeof plan?.comentarios_jefe === "string" ? plan.comentarios_jefe : "",
  );
  const [planVersionToken, setPlanVersionToken] = useState(() => plan?.plan_version_token || "");
  const [pintando, setPintando] = useState(false);
  const [indiceAgenteMobile, setIndiceAgenteMobile] = useState(0);
  const ultimaCeldaPintadaRef = useRef("");

  // Cargar contexto del grupo al montar
  useEffect(() => {
    if (!grupoId) return;
    setCargandoContexto(true);
    callListarContextoPlanGrupo({ grupo_id: grupoId, periodo })
      .then((res) => setContexto(res.data || null))
      .catch((e) => setErrLocal(e?.message || "Error al cargar contexto del grupo."))
      .finally(() => setCargandoContexto(false));
  }, [grupoId, periodo]);

  useEffect(() => {
    setPlanVersionToken(plan?.plan_version_token || "");
    setComentariosJefe(typeof plan?.comentarios_jefe === "string" ? plan.comentarios_jefe : "");
  }, [plan?.id, plan?.plan_version_token, plan?.comentarios_jefe]);

  useEffect(() => {
    if (!plan?.id || !grupoId || !periodo) return;
    let cancel = false;
    callListarPlanesTurnoServicio({ grupo_id: grupoId, periodo })
      .then((res) => {
        if (cancel) return;
        const fresh = (res.data?.items || []).find((p) => p.id === plan.id);
        if (!fresh) return;
        if (fresh.plan_version_token) setPlanVersionToken(fresh.plan_version_token);
        if (typeof fresh.comentarios_jefe === "string") setComentariosJefe(fresh.comentarios_jefe);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [plan?.id, grupoId, periodo]);

  const turnosPaleta = useMemo(() => {
    if (!contexto?.regimenes) return {};
    return buildPaletaDinamica(contexto.regimenes);
  }, [contexto]);

  // Seleccionar primer turno disponible como pincel por defecto
  useEffect(() => {
    const keys = Object.keys(turnosPaleta);
    if (keys.length > 0 && !paleta) setPaleta(keys[0]);
  }, [turnosPaleta, paleta]);

  const idxRegimenes = useMemo(() => contexto?.regimenes || {}, [contexto]);

  const agentesNoPlanificadosEnPlan = useMemo(() => {
    return agentes.filter((ag) => !esRegimenPlanificado(idxRegimenes[ag.regimen_horario_id]));
  }, [agentes, idxRegimenes]);

  const agentesEnriquecidos = useMemo(() => {
    const map = {};
    for (const p of contexto?.personas_grupo || []) {
      const pid = String(p.persona_id || "").trim();
      if (pid && !map[pid]) map[pid] = p;
    }
    return map;
  }, [contexto]);

  useEffect(() => {
    if (agentes.length > 0 && Object.keys(grilla).length === 0) {
      setGrilla(crearGrillaLimpia(agentes, dias));
    }
  }, [agentes, dias, grilla]);

  // Régimen fijo/rotativo: precargar mes desde el patrón (solo lectura en plan mensual)
  useEffect(() => {
    if (!contexto?.regimenes || dias.length === 0 || agentes.length === 0) return;
    setGrilla((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ag of agentes) {
        const regimen = idxRegimenes[ag.regimen_horario_id];
        if (!esRegimenDerivado(regimen)) continue;
        const meta = agentesEnriquecidos[ag.persona_id] || {};
        next[ag.persona_id] = generarGrillaDesdeRegimen(regimen, dias, meta);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [contexto, agentes, dias, idxRegimenes, agentesEnriquecidos]);

  // Al crear/editar, incluir automáticamente todos los agentes activos/vigentes del grupo.
  useEffect(() => {
    const lista = contexto?.personas_grupo || [];
    if (!lista.length) return;
    const nextAgentes = lista
      .map((p) => ({
        persona_id: String(p.persona_id || "").trim(),
        regimen_horario_id: p.regimen_horario_id || "",
        hlg_id: p.hlg_id || "",
      }))
      .filter((a) => a.persona_id)
      .sort((a, b) => {
        const prioridadTipo = (regimenId) => {
          const tipo = String(idxRegimenes?.[regimenId]?.tipo_patron || "").toLowerCase();
          if (tipo === "planificado") return 0;
          if (tipo === "rotativo") return 1;
          if (tipo === "fijo") return 2;
          return 3;
        };
        const pa = prioridadTipo(a.regimen_horario_id);
        const pb = prioridadTipo(b.regimen_horario_id);
        if (pa !== pb) return pa - pb;
        const la = String(agentesEnriquecidos[a.persona_id]?.persona_label || a.persona_id);
        const lb = String(agentesEnriquecidos[b.persona_id]?.persona_label || b.persona_id);
        return la.localeCompare(lb, "es");
      });
    setAgentes(nextAgentes);
    setGrilla((prev) => {
      const next = {};
      for (const ag of nextAgentes) {
        next[ag.persona_id] = normalizarFilaDias(prev[ag.persona_id], dias);
      }
      return next;
    });
  }, [contexto, dias, agentesEnriquecidos]);

  const esFilaEditable = useCallback(
    (pid) => esRegimenPlanificado(idxRegimenes[agentes.find((a) => a.persona_id === pid)?.regimen_horario_id]),
    [agentes, idxRegimenes],
  );

  // La grilla usa todos los agentes vigentes del grupo en el período (sin selección manual).

  const aplicarPincelEnCelda = useCallback((pid, ymd) => {
    if (!esFilaEditable(pid)) return;
    const key = `${pid}:${ymd}:${paleta}`;
    if (ultimaCeldaPintadaRef.current === key) return;
    const enriquecido = agentesEnriquecidos[pid];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return; // hard block
    }
    if (obtenerLicenciasDia(contexto, pid, ymd).length > 0) {
      return; // bloqueado por licencia/proyección existente del día
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
      if (celda?.tipo_dia === nueva.tipo_dia && celda?.turno_id === nueva.turno_id) {
        return prev;
      }
      ultimaCeldaPintadaRef.current = key;
      return { ...prev, [pid]: { ...prev[pid], [ymd]: nueva } };
    });
  }, [paleta, agentesEnriquecidos, esFilaEditable, contexto]);

  const iniciarPintado = useCallback((pid, ymd) => {
    setPintando(true);
    ultimaCeldaPintadaRef.current = "";
    aplicarPincelEnCelda(pid, ymd);
  }, [aplicarPincelEnCelda]);

  const continuarPintado = useCallback((pid, ymd) => {
    if (!pintando) return;
    aplicarPincelEnCelda(pid, ymd);
  }, [pintando, aplicarPincelEnCelda]);

  const finalizarPintado = useCallback(() => {
    setPintando(false);
    ultimaCeldaPintadaRef.current = "";
  }, []);

  const advertirNoModificable = useCallback(() => {
    setErrLocal("Régimen fijo/rotativo: fila no modificable desde este editor.");
  }, []);

  useEffect(() => {
    if (!pintando) return;
    const onUp = () => finalizarPintado();
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [pintando, finalizarPintado]);

  useEffect(() => {
    if (!agentes.length) {
      setIndiceAgenteMobile(0);
      return;
    }
    setIndiceAgenteMobile((prev) => {
      if (prev < 0) return 0;
      if (prev >= agentes.length) return agentes.length - 1;
      return prev;
    });
  }, [agentes]);

  const resumenAgente = useCallback((pid) => {
    const row = grilla[pid] || {};
    let trabajo = 0, francos = 0, noLaborables = 0;
    for (const cel of Object.values(row)) {
      const tipoDia = normalizarTipoDiaCelda(cel?.tipo_dia);
      if (tipoDia === "laborable" || tipoDia === "guardia") trabajo++;
      else if (tipoDia === "no_laborable") noLaborables++;
      else if (tipoDia === "franco") francos++;
    }
    return { trabajo, francos, noLaborables };
  }, [grilla]);

  const getCeldaEstado = useCallback((pid, ymd, cel) => {
    const enriquecido = agentesEnriquecidos[pid];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return "bloqueado";
    }
    if (obtenerLicenciasDia(contexto, pid, ymd).length > 0) return "licencia";
    if (contexto?.calendario_institucional_mes?.[ymd]?.es_feriado === true) return "institucional";
    const tipoDia = normalizarTipoDiaCelda(cel?.tipo_dia);
    if (tipoDia === "no_laborable") return "no_laborable";
    const regimen = enriquecido ? idxRegimenes[enriquecido.regimen_horario_id] : null;
    const asignado = esDiaAsignadoAlGrupo(regimen, ymd, enriquecido?.regimen_fecha_ancla);
    const esFranco = tipoDia === "franco" || tipoDia === "no_laborable";
    if (!asignado && !esFranco && cel?.turno_id) return "excepcion";
    if (!asignado) return "no_asignado";
    return "normal";
  }, [agentesEnriquecidos, idxRegimenes, contexto]);

  const extraerIntencionDia = useCallback((cel) => ({
    tipo_dia: normalizarTipoDiaCelda(cel?.tipo_dia),
    turno_id: cel?.turno_id != null && String(cel.turno_id).trim() !== "" ? String(cel.turno_id).trim() : null,
  }), []);

  const handleGuardar = useCallback(async () => {
    if (agentes.length === 0) {
      return setErrLocal("Agrega al menos un agente.");
    }
    if (agentes.length > 50) {
      return setErrLocal("[PLT-MAX-050] El plan no puede superar 50 agentes.");
    }
    const comTrim = String(comentariosJefe || "").trim();
    if (comTrim.length > 200) {
      return setErrLocal("Comentarios del jefe: máximo 200 caracteres.");
    }
    setErrLocal("");
    const datos = {
      grupo_id: grupoId,
      tipo_plan: "mensual",
      periodo,
      comentarios_jefe: comTrim || null,
      ...(planVersionToken ? { plan_version_token: planVersionToken } : {}),
      agentes: agentes.map((ag) => {
        const row = grilla[ag.persona_id] || {};
        const dias = {};
        for (const [ymd, cel] of Object.entries(row)) {
          dias[ymd] = extraerIntencionDia(cel);
        }
        return {
          persona_id: ag.persona_id,
          regimen_horario_id: ag.regimen_horario_id,
          hlg_id: ag.hlg_id,
          dias,
        };
      }),
    };
    const result = await onGuardar(datos, plan?.id || null);
    if (result?.ok === false) {
      setErrLocal(result.error || "No se pudo guardar el borrador.");
      return;
    }
    if (result?.plan_version_token) setPlanVersionToken(result.plan_version_token);
  }, [
    agentes,
    grilla,
    grupoId,
    periodo,
    plan,
    onGuardar,
    comentariosJefe,
    planVersionToken,
    extraerIntencionDia,
  ]);

  const labelAgente = (pid) => {
    const e = agentesEnriquecidos[pid];
    return e?.persona_label || pid;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onCerrar}>
      <div className="flex h-full w-full flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {plan ? "Editar Turno Mensual" : "Crear Turno Mensual"}
            </h2>
            <p className="text-sm text-slate-500">
              Período: <strong className="font-semibold text-slate-700">{periodo}</strong>
              {" · "}
              Grupo: <strong className="font-semibold text-slate-700">{grupoLabel || grupoId}</strong>
            </p>
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

        {/* Paleta dinamica de turnos (solo planificado) */}
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
            {" · "}
            Solo aplica a filas con régimen planificado
          </span>
          <button
            type="button"
            onClick={() => setAltoContraste((v) => !v)}
            className={`ml-auto rounded-lg border px-3 py-1 text-xs font-semibold transition ${
              altoContraste
                ? "border-slate-800 bg-slate-800 text-white hover:bg-black"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {altoContraste ? "Alto contraste: ON" : "Alto contraste: OFF"}
          </button>
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
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-fuchsia-100 border border-fuchsia-200"></span> Licencia/proyección</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-amber-100 border border-amber-200"></span> Feriado/asueto</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-orange-400 bg-yellow-100"></span> Excepcion</span>
        </div>

        {/* Grilla */}
        <div className="flex-1 overflow-auto px-2 py-3">
          {agentes.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 md:hidden">
              <button
                type="button"
                onClick={() => setIndiceAgenteMobile((v) => Math.max(0, v - 1))}
                disabled={indiceAgenteMobile <= 0}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                ←
              </button>
              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-xs font-semibold text-slate-800">
                  {labelAgente(agentes[indiceAgenteMobile]?.persona_id)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {indiceAgenteMobile + 1} / {agentes.length}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIndiceAgenteMobile((v) => Math.min(agentes.length - 1, v + 1))}
                disabled={indiceAgenteMobile >= agentes.length - 1}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
          {agentes.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              {cargandoContexto ? "Cargando..." : "Agrega agentes para comenzar a armar la grilla."}
            </div>
          ) : (
            <table className="min-w-max border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className={`sticky left-0 z-20 min-w-[132px] border-b border-r px-2 py-1 text-left text-xs font-semibold md:min-w-[210px] ${
                    altoContraste
                      ? "border-slate-400 bg-slate-200 text-slate-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
                    Agente
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.ymd}
                      className={`min-w-[28px] border-b px-0.5 py-1 text-center text-[10px] font-semibold ${
                        altoContraste ? "border-slate-400" : "border-slate-200"
                      } ${
                        contexto?.calendario_institucional_mes?.[dia.ymd]
                          ? altoContraste
                            ? "bg-amber-300 text-amber-950"
                            : "bg-amber-100 text-amber-900"
                          : dia.esFinde
                            ? altoContraste
                              ? "bg-rose-50 text-rose-700"
                              : "text-rose-500"
                            : altoContraste
                              ? "text-slate-700"
                              : "text-slate-500"
                      }`}
                      title={
                        contexto?.calendario_institucional_mes?.[dia.ymd]
                          ? `${dia.ymd} — ${
                              contexto?.calendario_institucional_mes?.[dia.ymd]?.motivo ||
                              contexto?.calendario_institucional_mes?.[dia.ymd]?.tipo ||
                              "Evento institucional"
                            }`
                          : dia.ymd
                      }
                    >
                      <div>{DOW_LABELS[dia.dow]}</div>
                      <div className="text-[10px] font-bold">{dia.d}</div>
                    </th>
                  ))}
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${altoContraste ? "border-slate-400 text-slate-800" : "border-slate-200 text-slate-600"}`}>Trab</th>
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${altoContraste ? "border-slate-400 text-slate-800" : "border-slate-200 text-slate-600"}`}>Franc</th>
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${altoContraste ? "border-slate-400 text-slate-800" : "border-slate-200 text-slate-600"}`}>No lab</th>
                  <th className={`border-b px-2 py-1 ${altoContraste ? "border-slate-400" : "border-slate-200"}`}></th>
                </tr>
              </thead>
              <tbody>
                {agentes.map((ag, idxAgente) => {
                  const res = resumenAgente(ag.persona_id);
                  const regimen = idxRegimenes[ag.regimen_horario_id];
                  const persona = agentesEnriquecidos[ag.persona_id] || {};
                  const editable = esRegimenPlanificado(regimen);
                  return (
                    <tr
                      key={ag.persona_id}
                      className={`group h-16 ${editable ? "" : "bg-slate-50/80"} ${
                        idxAgente === indiceAgenteMobile ? "table-row md:table-row" : "hidden md:table-row"
                      }`}
                    >
                      <td className={`sticky left-0 z-10 border-b border-r bg-white px-2 py-1 align-middle ${
                        altoContraste ? "border-slate-400" : "border-slate-200"
                      }`}>
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {labelAgente(ag.persona_id)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">
                          DNI: {String(persona?.persona_dni || "s/d")}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                          {labelTipoRegimen(regimen)}
                          {!editable ? " — solo lectura" : " — editable"}
                        </span>
                        <span className="max-w-[260px] whitespace-normal break-words text-[10px] text-slate-400">
                          Horarios: {detalleHorariosRegimen(regimen)}
                        </span>
                      </td>
                      {dias.map((dia) => {
                        const cel = grilla[ag.persona_id]?.[dia.ymd];
                        const esInstitucionalDia = Boolean(contexto?.calendario_institucional_mes?.[dia.ymd]);
                        const esFindeDia = Boolean(dia?.esFinde);
                        const estado = getCeldaEstado(ag.persona_id, dia.ymd, cel);
                        const tipoDiaCelda = normalizarTipoDiaCelda(cel?.tipo_dia);
                        const esNoLaborable = tipoDiaCelda === "no_laborable";
                        const esFranco =
                          !cel ||
                          tipoDiaCelda === "franco" ||
                          tipoDiaCelda === "no_laborable" ||
                          (!tipoDiaCelda && !cel?.turno_id);
                        const turno = cel?.turno_id || "";
                        const horarioDerivado = !editable
                          ? horarioDerivadoPorDia(regimen, dia.ymd, persona?.regimen_fecha_ancla)
                          : "";
                        const horarioPlanificado = editable ? horarioPlanificadoPorTurno(regimen, turno) : "";

                        if (estado === "bloqueado") {
                          return (
                            <td
                              key={dia.ymd}
                              className={`border px-0.5 py-0.5 align-middle ${
                                esInstitucionalDia
                                  ? altoContraste
                                    ? "bg-amber-200"
                                    : "bg-amber-100"
                                  : esFindeDia
                                    ? altoContraste
                                      ? "bg-rose-100"
                                      : "bg-rose-50"
                                  : ""
                              } ${altoContraste ? "border-slate-300" : "border-slate-200"}`}
                            >
                              <div
                                className={`mx-auto flex h-12 w-14 items-center justify-center rounded border text-[10px] ${
                                  altoContraste ? "border-slate-400" : "border-slate-200"
                                } ${BLOQUEADO_STYLE.bg} ${BLOQUEADO_STYLE.text}`}
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
                          if (estado === "no_asignado") style = NO_ASIGNADO_STYLE;
                          else style = esNoLaborable ? NO_LABORABLE_STYLE : FRANCO_STYLE;
                        } else {
                          style = turnosPaleta[turno] || { bg: "bg-green-300 hover:bg-green-400", text: "text-green-950" };
                        }
                        if (estado === "licencia") {
                          style = LICENCIA_STYLE;
                        }
                        if (estado === "institucional") {
                          // Fondo institucional se marca en toda la columna (td/th).
                          // La celda mantiene su color operativo.
                        }
                        if (estado === "excepcion") {
                          extraClass = "ring-2 ring-orange-400 ring-offset-1";
                        }
                        if (estado === "no_asignado" && esFranco && !esNoLaborable) {
                          style = NO_ASIGNADO_STYLE;
                        }

                        const tooltipParts = [dia.ymd];
                        if (estado === "excepcion") tooltipParts.push("(dia no asignado al grupo)");
                        if (estado === "no_asignado") tooltipParts.push("(no asignado)");
                        if (esNoLaborable) tooltipParts.push("(no laborable)");
                        if (estado === "institucional") {
                          const info = contexto?.calendario_institucional_mes?.[dia.ymd];
                          tooltipParts.push(`(${info?.tipo || "feriado"})`);
                        }
                        if (estado === "licencia") {
                          const evs = obtenerLicenciasDia(contexto, ag.persona_id, dia.ymd);
                          const codigos = evs.map((ev) => String(ev?.codigo_grilla || "").trim()).filter(Boolean);
                          tooltipParts.push(`(licencia ${codigos.join("/") || "vigente"})`);
                        }
                        tooltipParts.push(esNoLaborable ? "No laborable" : (esFranco ? "Franco" : turno));

                        const licenciaTxt = estado === "licencia"
                          ? obtenerLicenciasDia(contexto, ag.persona_id, dia.ymd)
                            .map((ev) => String(ev?.codigo_grilla || ev?.articulo_id || "LIC").trim())
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("/")
                          : "";
                        const etiquetaTurno = String(turnosPaleta?.[turno]?.label || turno || "").trim();
                        const horarioCelda = String(horarioDerivado || horarioPlanificado || "").trim();
                        const contenidoCelda = estado === "licencia"
                          ? (licenciaTxt || "LIC")
                          : (esFranco
                            ? (esNoLaborable ? "NL" : "F")
                            : (horarioCelda || etiquetaTurno));
                        const mostrarDosLineasTurnoHora =
                          editable &&
                          !esFranco &&
                          estado !== "licencia" &&
                          Boolean(etiquetaTurno || horarioCelda);
                        const celContent = (
                          <div
                            className={`mx-auto flex h-12 w-14 items-center justify-center rounded border px-0.5 font-semibold leading-tight ${
                              altoContraste
                                ? "border-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                                : "border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                            } ${style.bg} ${style.text} ${extraClass} ${editable ? "" : "cursor-default opacity-90"}`}
                            title={tooltipParts.join(" ")}
                          >
                            {mostrarDosLineasTurnoHora ? (
                              <span className="flex w-full flex-col items-center justify-center leading-none">
                                <span className="text-[8px] font-bold">{etiquetaTurno || "-"}</span>
                                <span className="mt-0.5 text-[7px]">{horarioCelda || "-"}</span>
                              </span>
                            ) : (
                              <span className={clasesTextoCelda(contenidoCelda)}>{contenidoCelda}</span>
                            )}
                          </div>
                        );

                        return (
                          <td
                            key={dia.ymd}
                            className={`border px-0.5 py-0.5 align-middle ${
                              esInstitucionalDia
                                ? altoContraste
                                  ? "bg-amber-200"
                                  : "bg-amber-100"
                                : esFindeDia
                                  ? altoContraste
                                    ? "bg-rose-100"
                                    : "bg-rose-50"
                                : ""
                            } ${altoContraste ? "border-slate-300" : "border-slate-200"}`}
                          >
                            {editable && estado !== "licencia" ? (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  iniciarPintado(ag.persona_id, dia.ymd);
                                }}
                                onMouseEnter={() => continuarPintado(ag.persona_id, dia.ymd)}
                                onMouseUp={finalizarPintado}
                                onClick={(e) => e.preventDefault()}
                                className="block"
                              >
                                {celContent}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={editable ? undefined : advertirNoModificable}
                                className={`block ${editable ? "" : "cursor-not-allowed"}`}
                              >
                                {celContent}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold ${altoContraste ? "border-slate-300 text-slate-800" : "border-slate-100 text-slate-700"}`}>{res.trabajo}</td>
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold ${altoContraste ? "border-slate-300 text-slate-700" : "border-slate-100 text-slate-500"}`}>{res.francos}</td>
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold ${altoContraste ? "border-slate-300 text-slate-700" : "border-slate-100 text-slate-500"}`}>{res.noLaborables}</td>
                      <td className={`border-b px-1 py-1 align-middle ${altoContraste ? "border-slate-300" : "border-slate-100"}`} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3">
          <label className="mb-2 block text-xs font-medium text-slate-600">
            Comentarios del jefe (opcional, máx. 200)
          </label>
          <textarea
            value={comentariosJefe}
            onChange={(e) => setComentariosJefe(e.target.value.slice(0, 200))}
            rows={2}
            className="mb-3 w-full max-w-xl rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
            placeholder="Notas visibles en las vistas del turno…"
          />
          {(errorGuardar || errLocal) && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorGuardar || errLocal}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {agentes.length}/50 agentes
              {agentes.length > 50 ? " · supera el límite" : ""}
            </p>
            <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || agentes.length === 0 || agentes.length > 50}
            onClick={handleGuardar}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar borrador"}
          </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
