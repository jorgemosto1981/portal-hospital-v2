import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callListarContextoPlanGrupo, callListarPlanesTurnoServicio } from "../../../services/callables.js";
import {
  esRegimenDerivado,
  esRegimenPlanificado,
  generarGrillaDesdeRegimen,
  labelTipoRegimen,
} from "./planGrillaRegimenUtils.js";
import {
  FRANCO_STYLE,
  BLOQUEADO_STYLE,
  claseHeaderColumna,
  claseTdColumna,
  claseHeaderAgenteSticky,
  claseCeldaAgenteSticky,
  claseBordeTablaResumen,
  clasesTextoCelda,
  CHIP_BASE,
  estiloChipDesdeVariante,
  varianteCeldaMensual,
} from "../../../features/grilla/grillaTurnosVisual.js";
import GrillaTurnosLeyenda from "../../../features/grilla/GrillaTurnosLeyenda.jsx";
import { ymdDesdeValorLaboral } from "../../datos-laborales/utils.js";
import { contarHuecosTurnoPlan, tooltipBloqueoHuecosPlan } from "./planHuecosTurnoUtils.js";
import { filaKeyAg } from "../../../features/grilla/grillaMesFilasUtils.js";
import {
  buildPaletaEditorPlanMensual,
  horarioPlanificadoPorTurnoRegimen,
  turnoPermitidoEnRegimenPlan,
} from "../../../features/planes/planPaletaTurnosUtils.js";

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
const ISO_DOW_LETTERS = { 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S", 7: "D" };

function esTipoDiaConJornada(tipoDiaRaw) {
  const t = String(tipoDiaRaw || "").trim().toLowerCase().replace(/\s+/g, "_");
  return t === "laborable" || t === "guardia";
}

/** Patrón real del régimen fijo: solo días laborables del patrón, sin catálogo turnos_disponibles. */
function detalleHorariosRegimenFijo(regimen) {
  const byHorario = new Map();
  for (const d of regimen.dias || []) {
    if (!esTipoDiaConJornada(d?.tipo_dia)) continue;
    const h = valorHorario(d.turno || d);
    if (!h) continue;
    const ds = Number(d.dia_semana);
    if (!Number.isFinite(ds) || ds < 1 || ds > 7) continue;
    if (!byHorario.has(h)) byHorario.set(h, []);
    byHorario.get(h).push(ds);
  }
  if (byHorario.size === 0) return "Sin horario fijo";
  return [...byHorario.entries()]
    .map(([h, diasSem]) => {
      diasSem.sort((a, b) => a - b);
      const letras = diasSem.map((ds) => ISO_DOW_LETTERS[ds] || "?").join("");
      return `${letras} ${h}`;
    })
    .join(" · ");
}

/** Horarios distintos del ciclo rotativo (sin unión de turnos_disponibles). */
function detalleHorariosRegimenRotativo(regimen) {
  const horarios = [];
  const horariosSet = new Set();
  for (const c of regimen.ciclo || []) {
    if (!esTipoDiaConJornada(c?.tipo_dia)) continue;
    const h = valorHorario(c.turno || c);
    if (!h || horariosSet.has(h)) continue;
    horariosSet.add(h);
    horarios.push(h);
  }
  return horarios.length ? horarios.join(" · ") : "Sin horario rotativo";
}

/** Hard block: fecha fuera de vigencia HLG */
function esDiaEnVigenciaHlg(fechaYmd, fechaInicio, fechaFin) {
  const fi = ymdDesdeValorLaboral(fechaInicio);
  const ff = ymdDesdeValorLaboral(fechaFin);
  if (fi && fechaYmd < fi) return false;
  if (ff && fechaYmd > ff) return false;
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
    return detalleHorariosRegimenFijo(regimen);
  }
  if (tipo === "rotativo") {
    return detalleHorariosRegimenRotativo(regimen);
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

function crearGrillaLimpia(agentes, dias) {
  const grilla = {};
  for (const ag of agentes) {
    const key = filaKeyAg(ag);
    grilla[key] = {};
    for (const dia of dias) {
      grilla[key][dia.ymd] = { tipo_dia: "franco", turno_id: null };
    }
  }
  return grilla;
}

function normalizarCeldaDesdePersistencia(cel) {
  if (!cel || typeof cel !== "object") {
    return { tipo_dia: "franco", turno_id: null };
  }
  const tipo = normalizarTipoDiaCelda(cel.tipo_dia);
  const tidRaw = cel.turno_id;
  const turno_id =
    tidRaw != null && String(tidRaw).trim() !== "" ? String(tidRaw).trim() : null;
  const out = { tipo_dia: tipo, turno_id };
  const ingreso = String(cel.ingreso || "").trim();
  const egreso = String(cel.egreso || "").trim();
  if (ingreso) out.ingreso = ingreso;
  if (egreso) out.egreso = egreso;
  if (cel.es_feriado === true) out.es_feriado = true;
  return out;
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
    base[dia.ymd] = normalizarCeldaDesdePersistencia(actual);
  }
  return base;
}

/** Fila con al menos un día persistido en Firestore (foto R0/R2). */
function filaDiasTieneFotoPersistida(fila) {
  if (!fila || typeof fila !== "object") return false;
  return Object.keys(fila).length > 0;
}

/**
 * Carga canónica: dias[] enriquecidos del plan persistido (no reconstruir desde régimen).
 * @returns {Record<string, object>|null} null → bootstrap con generarGrillaDesdeRegimen
 */
function diasCanonicoDesdePlan(plan, agRef, diasMes) {
  if (!plan?.id) return null;
  const hid = String(agRef?.hlg_id || "").trim();
  const pid = String(agRef?.persona_id || "").trim();
  const ag = (plan.agentes || []).find((a) =>
    hid ? String(a.hlg_id || "").trim() === hid : String(a.persona_id || "").trim() === pid,
  );
  const row = ag?.dias;
  if (!filaDiasTieneFotoPersistida(row)) return null;
  return normalizarFilaDias(row, diasMes);
}

function construirDiasAgenteParaGuardar({
  ag,
  row,
  meta,
  regimen,
  plan,
  diasMes,
  extraerIntencionDia,
}) {
  const canonRow =
    regimen && esRegimenDerivado(regimen) ? diasCanonicoDesdePlan(plan, ag, diasMes) : null;
  const dias = {};
  for (const dia of diasMes) {
    const ymd = dia.ymd;
    if (meta && !esDiaEnVigenciaHlg(ymd, meta.fecha_inicio, meta.fecha_fin)) {
      dias[ymd] = { tipo_dia: "franco", turno_id: null };
      continue;
    }
    let cel;
    if (regimen && esRegimenDerivado(regimen)) {
      cel = canonRow?.[ymd] ?? row[ymd];
    } else {
      cel = row[ymd] ?? canonRow?.[ymd];
    }
    let intencion = extraerIntencionDia(cel || { tipo_dia: "franco", turno_id: null });
    // R0: fijo/rotativo — turno_id lo deriva el backend al guardar.
    if (regimen && esRegimenDerivado(regimen)) {
      intencion = { tipo_dia: intencion.tipo_dia, turno_id: null };
    }
    dias[ymd] = intencion;
  }
  return dias;
}

export default function GrillaMensualEditor({
  plan,
  modoVistaEquipo = false,
  modoIncorporacionAgentesNuevos = false,
  agentesNuevosPermitidos = [],
  grupoId,
  grupoLabel,
  periodo,
  guardando,
  errorGuardar,
  puedeGuardarPlan = true,
  motivoGuardarDeshabilitado,
  onGuardar,
  onCerrar,
  onHuecosTurnoChange,
}) {
  const dias = useMemo(() => diasDelMes(periodo), [periodo]);

  const [contexto, setContexto] = useState(null);
  const [cargandoContexto, setCargandoContexto] = useState(false);

  const [agentes, setAgentes] = useState(() => {
    if (plan?.agentes?.length) return plan.agentes.map((a) => ({
      fila_id: a.fila_id || filaKeyAg(a),
      persona_id: a.persona_id,
      regimen_horario_id: a.regimen_horario_id,
      hlg_id: a.hlg_id,
    }));
    return [];
  });

  const [grilla, setGrilla] = useState(() => {
    if (plan?.agentes?.length) {
      const diasInit = diasDelMes(periodo);
      const g = {};
      for (const ag of plan.agentes) {
        g[filaKeyAg(ag)] = normalizarFilaDias(ag.dias, diasInit);
      }
      return g;
    }
    return {};
  });

  const [paleta, setPaleta] = useState("");
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

  const idxRegimenes = useMemo(() => contexto?.regimenes || {}, [contexto]);

  const { turnosPaleta, permitidosPorRegimen } = useMemo(() => {
    if (!contexto?.regimenes) {
      return { turnosPaleta: {}, permitidosPorRegimen: {} };
    }
    return buildPaletaEditorPlanMensual(
      contexto.regimenes,
      agentes,
      PALETA_COLORES_BASE,
    );
  }, [contexto, agentes]);

  const hayFilasPlanificadas = useMemo(
    () =>
      agentes.some((ag) =>
        esRegimenPlanificado(idxRegimenes[ag.regimen_horario_id]),
      ),
    [agentes, idxRegimenes],
  );

  // Seleccionar primer turno planificado como pincel por defecto
  useEffect(() => {
    const keys = Object.keys(turnosPaleta);
    if (keys.length === 0) {
      if (paleta) setPaleta("");
      return;
    }
    if (!paleta || (paleta !== "F" && !keys.includes(paleta))) {
      setPaleta(keys[0]);
    }
  }, [turnosPaleta, paleta]);

  const agentesNoPlanificadosEnPlan = useMemo(() => {
    return agentes.filter((ag) => !esRegimenPlanificado(idxRegimenes[ag.regimen_horario_id]));
  }, [agentes, idxRegimenes]);

  const agentesEnriquecidos = useMemo(() => {
    const map = {};
    for (const p of contexto?.personas_grupo || []) {
      const key = filaKeyAg(p);
      if (key) map[key] = p;
    }
    return map;
  }, [contexto]);

  const avisoTramosPlanificados = useMemo(() => {
    const porPersona = new Map();
    for (const ag of agentes) {
      const pid = String(ag.persona_id || "").trim();
      if (!pid) continue;
      if (!porPersona.has(pid)) porPersona.set(pid, []);
      porPersona.get(pid).push(ag);
    }
    const filas = [];
    for (const lista of porPersona.values()) {
      if (lista.length < 2) continue;
      for (const ag of lista) {
        if (!esRegimenPlanificado(idxRegimenes[ag.regimen_horario_id])) continue;
        const meta = agentesEnriquecidos[filaKeyAg(ag)] || {};
        const vd = meta.vigente_desde
          ? `${meta.vigente_desde.slice(8, 10)}/${meta.vigente_desde.slice(5, 7)}`
          : null;
        const vh = meta.vigente_hasta
          ? `${meta.vigente_hasta.slice(8, 10)}/${meta.vigente_hasta.slice(5, 7)}`
          : null;
        filas.push({
          key: filaKeyAg(ag),
          etiqueta: String(meta.persona_label || meta.persona_id || "").trim(),
          rango: vd && vh ? `${vd}–${vh}` : null,
        });
      }
    }
    return filas;
  }, [agentes, agentesEnriquecidos, idxRegimenes]);

  useEffect(() => {
    if (agentes.length > 0 && Object.keys(grilla).length === 0) {
      setGrilla(crearGrillaLimpia(agentes, dias));
    }
  }, [agentes, dias, grilla]);

  // Régimen fijo/rotativo: foto canónica del plan o bootstrap desde patrón (plan nuevo / fila vacía)
  useEffect(() => {
    if (!contexto?.regimenes || dias.length === 0 || agentes.length === 0) return;
    setGrilla((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ag of agentes) {
        const regimen = idxRegimenes[ag.regimen_horario_id];
        if (!esRegimenDerivado(regimen)) continue;
        const key = filaKeyAg(ag);
        const meta = agentesEnriquecidos[key] || {};
        const canon = diasCanonicoDesdePlan(plan, ag, dias);
        const row = canon ?? generarGrillaDesdeRegimen(regimen, dias, meta);
        next[key] = row;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [contexto, agentes, dias, idxRegimenes, agentesEnriquecidos, plan]);

  const esModoIncorporacion =
    modoIncorporacionAgentesNuevos || String(plan?.plan_rol || "").trim() === "incorporacion";

  /** En plt_inc: solo filas incorporables (nunca todo el grupo si falta meta del banner). */
  const idsAgentesNuevos = useMemo(() => {
    if (!esModoIncorporacion) return null;
    const ids = new Set();
    for (const a of agentesNuevosPermitidos || []) {
      const pid = String(a.persona_id || "").trim();
      if (pid) ids.add(pid);
    }
    for (const a of contexto?.agentes_nuevos || []) {
      const pid = String(a.persona_id || "").trim();
      if (pid) ids.add(pid);
    }
    for (const a of plan?.agentes || []) {
      const pid = String(a.persona_id || "").trim();
      if (pid) ids.add(pid);
    }
    return ids;
  }, [esModoIncorporacion, agentesNuevosPermitidos, contexto?.agentes_nuevos, plan?.agentes, plan?.id]);

  // Al crear/editar plan principal: todos los vigentes del grupo. En incorporación: solo idsAgentesNuevos.
  useEffect(() => {
    const lista = contexto?.personas_grupo || [];
    if (!lista.length) return;
    let filtrada = lista;
    if (esModoIncorporacion) {
      if (!idsAgentesNuevos || idsAgentesNuevos.size === 0) return;
      filtrada = lista.filter((p) => idsAgentesNuevos.has(String(p.persona_id || "").trim()));
      if (filtrada.length === 0) return;
    }
    const nextAgentes = filtrada
      .map((p) => ({
        fila_id: p.fila_id || filaKeyAg(p),
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
        const la = String(agentesEnriquecidos[filaKeyAg(a)]?.persona_label || a.persona_id);
        const lb = String(agentesEnriquecidos[filaKeyAg(b)]?.persona_label || b.persona_id);
        if (la !== lb) return la.localeCompare(lb, "es");
        return String(a.vigente_desde || a.hlg_id || "").localeCompare(String(b.vigente_desde || b.hlg_id || ""), "es");
      });
    setAgentes(nextAgentes);
    setGrilla((prev) => {
      const next = {};
      for (const ag of nextAgentes) {
        next[filaKeyAg(ag)] = normalizarFilaDias(prev[filaKeyAg(ag)], dias);
      }
      return next;
    });
  }, [contexto, dias, agentesEnriquecidos, esModoIncorporacion, idsAgentesNuevos]);

  const esFilaEditable = useCallback(
    (filaKey) => {
      const ag = agentes.find((a) => filaKeyAg(a) === filaKey);
      return esRegimenPlanificado(idxRegimenes[ag?.regimen_horario_id]);
    },
    [agentes, idxRegimenes],
  );

  const aplicarPincelEnCelda = useCallback((filaKey, ymd) => {
    const ag = agentes.find((a) => filaKeyAg(a) === filaKey);
    const pid = String(ag?.persona_id || "").trim();
    if (esModoIncorporacion && idsAgentesNuevos && pid && !idsAgentesNuevos.has(pid)) return;
    if (!paleta || !esFilaEditable(filaKey)) return;
    if (
      paleta !== "F" &&
      !turnoPermitidoEnRegimenPlan(permitidosPorRegimen, ag?.regimen_horario_id, paleta)
    ) {
      return;
    }
    const key = `${filaKey}:${ymd}:${paleta}`;
    if (ultimaCeldaPintadaRef.current === key) return;
    const enriquecido = agentesEnriquecidos[filaKey];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return;
    }
    if (pid && obtenerLicenciasDia(contexto, pid, ymd).length > 0) {
      return;
    }
    setGrilla((prev) => {
      const celda = prev[filaKey]?.[ymd];
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
      return { ...prev, [filaKey]: { ...prev[filaKey], [ymd]: nueva } };
    });
  }, [
    paleta,
    agentesEnriquecidos,
    esFilaEditable,
    contexto,
    esModoIncorporacion,
    idsAgentesNuevos,
    agentes,
    permitidosPorRegimen,
  ]);

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

  const resumenAgente = useCallback((filaKey) => {
    const row = grilla[filaKey] || {};
    let trabajo = 0, francos = 0, noLaborables = 0;
    for (const cel of Object.values(row)) {
      const tipoDia = normalizarTipoDiaCelda(cel?.tipo_dia);
      if (tipoDia === "laborable" || tipoDia === "guardia") trabajo++;
      else if (tipoDia === "no_laborable") noLaborables++;
      else if (tipoDia === "franco") francos++;
    }
    return { trabajo, francos, noLaborables };
  }, [grilla]);

  const getCeldaEstado = useCallback((filaKey, ymd, cel, personaId) => {
    const enriquecido = agentesEnriquecidos[filaKey];
    if (enriquecido && !esDiaEnVigenciaHlg(ymd, enriquecido.fecha_inicio, enriquecido.fecha_fin)) {
      return "bloqueado";
    }
    if (personaId && obtenerLicenciasDia(contexto, personaId, ymd).length > 0) return "licencia";
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

  const huecosTurno = useMemo(
    () =>
      modoVistaEquipo
        ? 0
        : contarHuecosTurnoPlan(agentes, grilla, {
            omitirCelda: (filaKey, ymd) => {
              const meta = agentesEnriquecidos[filaKey];
              if (meta && !esDiaEnVigenciaHlg(ymd, meta.fecha_inicio, meta.fecha_fin)) {
                return true;
              }
              const ag = agentes.find((a) => filaKeyAg(a) === filaKey);
              const regimen = idxRegimenes[ag?.regimen_horario_id];
              return esRegimenDerivado(regimen);
            },
          }),
    [modoVistaEquipo, agentes, grilla, agentesEnriquecidos, idxRegimenes],
  );

  useEffect(() => {
    onHuecosTurnoChange?.(huecosTurno);
  }, [huecosTurno, onHuecosTurnoChange]);

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
    let planFuente = plan;
    if (plan?.id && grupoId && periodo) {
      try {
        const res = await callListarPlanesTurnoServicio({ grupo_id: grupoId, periodo });
        const fresh = (res.data?.items || []).find((p) => p.id === plan.id);
        if (fresh) planFuente = fresh;
      } catch {
        /* conservar plan en memoria */
      }
    }
    const datos = {
      grupo_id: grupoId,
      tipo_plan: "mensual",
      periodo,
      comentarios_jefe: comTrim || null,
      ...(planVersionToken ? { plan_version_token: planVersionToken } : {}),
      agentes: agentes.map((ag) => {
        const filaKey = filaKeyAg(ag);
        const row = grilla[filaKey] || {};
        const meta = agentesEnriquecidos[filaKey];
        const agPlan = (planFuente?.agentes || plan?.agentes || []).find(
          (a) =>
            String(a.hlg_id || "").trim() === String(ag.hlg_id || "").trim()
            || (
              !ag.hlg_id
              && String(a.persona_id || "").trim() === String(ag.persona_id || "").trim()
            ),
        );
        const regimen = idxRegimenes[ag.regimen_horario_id];
        const diasAgente = construirDiasAgenteParaGuardar({
          ag,
          row,
          meta,
          regimen,
          plan: planFuente,
          diasMes: dias,
          extraerIntencionDia,
        });
        return {
          persona_id: ag.persona_id,
          regimen_horario_id: agPlan?.regimen_horario_id || ag.regimen_horario_id,
          hlg_id: agPlan?.hlg_id || ag.hlg_id,
          dias: diasAgente,
        };
      }),
    };
    const result = await onGuardar(datos, planFuente?.id || plan?.id || null, {});
    if (result?.ok === false) {
      setErrLocal(result.error || "No se pudo guardar el borrador.");
      return;
    }
    if (result?.plan_version_token) setPlanVersionToken(result.plan_version_token);
  }, [
    agentes,
    grilla,
    dias,
    grupoId,
    periodo,
    plan,
    onGuardar,
    comentariosJefe,
    planVersionToken,
    extraerIntencionDia,
    agentesEnriquecidos,
    idxRegimenes,
  ]);

  const labelAgente = (filaKey) => {
    const e = agentesEnriquecidos[filaKey];
    return e?.persona_label || e?.persona_id || filaKey;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onCerrar}>
      <div className="flex h-full w-full flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {modoVistaEquipo
                ? "Ver turnos del equipo"
                : esModoIncorporacion
                  ? "Plan de incorporación"
                  : plan
                    ? "Editar Turno Mensual"
                    : "Crear Turno Mensual"}
            </h2>
            <p className="text-sm text-slate-500">
              Período: <strong className="font-semibold text-slate-700">{periodo}</strong>
              {" · "}
              Grupo: <strong className="font-semibold text-slate-700">{grupoLabel || grupoId}</strong>
              {modoVistaEquipo ? (
                <span className="text-slate-600">
                  {" "}
                  · Sin agentes planificados: turnos derivados del régimen (solo lectura).
                </span>
              ) : null}
            </p>
          </div>
          <button onClick={onCerrar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {esModoIncorporacion ? (
          <div className="mx-5 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Plan paralelo de incorporación: solo agentes nuevos planificados. El plan operativo habilitado no
            se modifica hasta que RRHH apruebe y se mergee la grilla.
          </div>
        ) : null}

        {!modoVistaEquipo && huecosTurno > 0 ? (
          <div
            className="mx-5 mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-950"
            role="status"
            title={tooltipBloqueoHuecosPlan(huecosTurno)}
          >
            <p className="font-semibold">
              Días sin turno asignado:{" "}
              <span className="font-mono tabular-nums">{huecosTurno}</span>
            </p>
            <p className="mt-1 text-xs text-rose-900">
              Hay asignaciones laborables o de guardia sin turno que impedirán la habilitación del plan.
              Completá la grilla antes de enviar o solicitar aprobación.
            </p>
          </div>
        ) : null}

        {avisoTramosPlanificados.length > 0 ? (
          <div className="mx-5 mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
            <p>
              Este mes hay agentes con <strong>varios tramos</strong> (una fila por tramo).
              Podés editar turnos <strong>solo en la fila planificada</strong>, en los días de su vigencia.
            </p>
            {avisoTramosPlanificados.map((t) => (
              <p key={t.key} className="mt-1 text-indigo-900">
                <span className="font-semibold">{t.etiqueta}</span>
                {t.rango ? ` · editable ${t.rango}` : null}
              </p>
            ))}
          </div>
        ) : null}

        {cargandoContexto && (
          <div className="px-5 py-3 text-sm text-slate-500">Cargando contexto del grupo...</div>
        )}

        {/* Paleta de turnos: solo regímenes planificados */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2">
          {hayFilasPlanificadas ? (
            <>
              <span className="text-xs font-medium text-slate-500">Pincel:</span>
              {Object.entries(turnosPaleta).map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  title={style.horario ? `${key} · ${style.horario}` : key}
                  onClick={() => setPaleta(key)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${style.bg} ${style.text} ${
                    paleta === key ? "ring-2 ring-indigo-400 ring-offset-1" : ""
                  }`}
                >
                  {style.label}
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
            </>
          ) : (
            <span className="text-xs text-slate-500">
              Sin filas planificadas en este grupo: la grilla es solo lectura (régimen fijo o rotativo).
            </span>
          )}
        </div>

        {errLocal && (
          <div className="mx-5 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
            {errLocal}
          </div>
        )}

        <GrillaTurnosLeyenda />

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
                  {labelAgente(filaKeyAg(agentes[indiceAgenteMobile] || {}))}
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
                  <th className={claseHeaderAgenteSticky()}>
                    Agente
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.ymd}
                      className={`min-w-[28px] ${claseHeaderColumna({
                        esFeriado: Boolean(contexto?.calendario_institucional_mes?.[dia.ymd]),
                        esFinde: dia.esFinde,
                      })}`}
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
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${claseBordeTablaResumen()}`}>Trab</th>
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${claseBordeTablaResumen()}`}>Franc</th>
                  <th className={`border-b px-2 py-1 text-center text-xs font-semibold ${claseBordeTablaResumen()}`}>No lab</th>
                  <th className={`border-b px-2 py-1 ${claseBordeTablaResumen()}`}></th>
                </tr>
              </thead>
              <tbody>
                {agentes.map((ag, idxAgente) => {
                  const filaKey = filaKeyAg(ag);
                  const res = resumenAgente(filaKey);
                  const regimen = idxRegimenes[ag.regimen_horario_id];
                  const persona = agentesEnriquecidos[filaKey] || {};
                  const editable = esRegimenPlanificado(regimen);
                  return (
                    <tr
                      key={filaKey}
                      className={`group h-16 ${editable ? "" : "bg-slate-50/80"} ${
                        idxAgente === indiceAgenteMobile ? "table-row md:table-row" : "hidden md:table-row"
                      }`}
                    >
                      <td className={claseCeldaAgenteSticky()}>
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {labelAgente(filaKey)}
                        </span>
                        {persona.vigente_desde && persona.vigente_hasta ? (
                          <span className="mt-0.5 block text-[10px] text-indigo-700">
                            Tramo: {persona.vigente_desde.slice(8, 10)}/{persona.vigente_desde.slice(5, 7)}–
                            {persona.vigente_hasta.slice(8, 10)}/{persona.vigente_hasta.slice(5, 7)}
                          </span>
                        ) : null}
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
                        const cel = grilla[filaKey]?.[dia.ymd];
                        const esInstitucionalDia = Boolean(contexto?.calendario_institucional_mes?.[dia.ymd]);
                        const esFindeDia = Boolean(dia?.esFinde);
                        const estado = getCeldaEstado(filaKey, dia.ymd, cel, ag.persona_id);
                        const tipoDiaCelda = normalizarTipoDiaCelda(cel?.tipo_dia);
                        const esNoLaborable = tipoDiaCelda === "no_laborable";
                        const esFranco =
                          !cel ||
                          tipoDiaCelda === "franco" ||
                          tipoDiaCelda === "no_laborable" ||
                          (!tipoDiaCelda && !cel?.turno_id);
                        const turno = cel?.turno_id || "";
                        const horarioPersistidoCelda =
                          !editable && cel ? horarioIngresoEgreso(cel) : "";
                        const horarioDerivado = !editable
                          ? horarioDerivadoPorDia(regimen, dia.ymd, persona?.regimen_fecha_ancla)
                          : "";
                        const horarioPlanificado = editable
                          ? horarioPlanificadoPorTurnoRegimen(regimen, turno)
                          : "";

                        if (estado === "bloqueado") {
                          return (
                            <td
                              key={dia.ymd}
                              className={claseTdColumna({
                                esFeriado: esInstitucionalDia,
                                esFinde: esFindeDia,
                              })}
                            >
                              <div
                                className={`${CHIP_BASE} text-[10px] ${BLOQUEADO_STYLE.bg} ${BLOQUEADO_STYLE.text}`}
                                style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)" }}
                                title={`${dia.ymd} — Fuera de vigencia HLG`}
                              >
                                —
                              </div>
                            </td>
                          );
                        }

                        const horarioCeldaPre = String(
                          horarioPersistidoCelda || horarioDerivado || horarioPlanificado || "",
                        ).trim();
                        const variantMensual = varianteCeldaMensual({
                          esFranco,
                          esNoLaborable,
                          horarioText: horarioCeldaPre,
                          turnoId: turno,
                          estado,
                          tieneLicencia: estado === "licencia",
                        });
                        let style = estiloChipDesdeVariante(variantMensual);
                        let extraClass = "";
                        if (variantMensual === "laborable" && turno && turnosPaleta[turno]) {
                          style = turnosPaleta[turno];
                        }
                        if (estado === "institucional") {
                          // Fondo institucional en columna; chip conserva color operativo.
                        }
                        if (estado === "excepcion") {
                          extraClass = "ring-2 ring-orange-400 ring-offset-1";
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
                        const horarioCelda = horarioCeldaPre;
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
                            className={`${CHIP_BASE} ${style.bg} ${style.text} ${extraClass} ${editable ? "" : "cursor-default opacity-90"}`}
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
                            className={claseTdColumna({
                              esFeriado: esInstitucionalDia,
                              esFinde: esFindeDia,
                            })}
                          >
                            {editable && estado !== "licencia" ? (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  iniciarPintado(filaKey, dia.ymd);
                                }}
                                onMouseEnter={() => continuarPintado(filaKey, dia.ymd)}
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
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold border-slate-300 text-slate-800`}>{res.trabajo}</td>
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold border-slate-300 text-slate-700`}>{res.francos}</td>
                      <td className={`border-b px-2 py-1 align-middle text-center font-semibold border-slate-300 text-slate-700`}>{res.noLaborables}</td>
                      <td className="border-b border-slate-300 px-1 py-1 align-middle" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3">
          {modoVistaEquipo ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {agentes.length} agente{agentes.length === 1 ? "" : "s"} · vista sin plan mensual
              </p>
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-xl bg-slate-700 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
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
                    disabled={
                      guardando
                      || agentes.length === 0
                      || agentes.length > 50
                      || !puedeGuardarPlan
                    }
                    title={!puedeGuardarPlan ? motivoGuardarDeshabilitado : undefined}
                    onClick={handleGuardar}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {guardando ? "Guardando..." : "Guardar borrador"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
