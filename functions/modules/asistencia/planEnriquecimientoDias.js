"use strict";

/**
 * Enriquece agentes[].dias del plan mensual al guardar (foto teórica en borrador).
 * Usa regímenes, calendario institucional y la misma resolución que grilla_aprobada.
 */

const { db } = require("../shared/context");
const { getIndiceCalendario } = require("../shared/calendarService");
const { buildCapaTeoricaSegmentada, ymdHoraToIso } = require("./capaTeoricaSegmentosCore");
const { resolverDiaConPreCarga, diasDelMes } = require("./rdaTurnoTeoricoWorker");
const {
  isoToHhmmInstitucional,
  toHhmmInstitucionalDisplay,
} = require("../shared/horarioInstitucionalDisplay");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";
const { sanitizarDiasPlanSegunVigenciaHlg } = require("./planVigenciaHlg");

const TIPOS_DIA = new Set(["laborable", "guardia", "franco", "no_laborable"]);

function normalizarTipoDia(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (TIPOS_DIA.has(t)) return t;
  if (t === "no-laborable" || t === "nolaborable") return "no_laborable";
  return "franco";
}

function hhmmDesdeTurno(turno) {
  if (!turno) return { ingreso: null, egreso: null };
  const ingreso = turno.ingreso || turno.hora_ingreso || null;
  const egreso = turno.egreso || turno.hora_egreso || null;
  return {
    ingreso: ingreso ? String(ingreso).trim().slice(0, 5) : null,
    egreso: egreso ? String(egreso).trim().slice(0, 5) : null,
  };
}

function celdaPlanDesdeResolucion(fechaYmd, res, capa) {
  const tipo = normalizarTipoDia(capa.tipo_dia || res.tipo_dia);
  const esFranco = tipo === "franco" || tipo === "no_laborable";
  const turnoId =
    capa.turno_compuesto_id ||
    res.turno_teorico?.turno_id ||
    null;
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  let ingresoIso = segmentos[0]?.ingreso_iso || null;
  let egresoIso = segmentos.length ? segmentos[segmentos.length - 1].egreso_iso : null;
  const { ingreso: ingHh, egreso: egrHh } = hhmmDesdeTurno(res.turno_teorico);
  let ingreso = esFranco
    ? null
    : toHhmmInstitucionalDisplay(ingHh) ||
      isoToHhmmInstitucional(ingresoIso) ||
      toHhmmInstitucionalDisplay(capa.ingreso) ||
      toHhmmInstitucionalDisplay(capa.ingreso_teorico_final);
  let egreso = esFranco
    ? null
    : toHhmmInstitucionalDisplay(egrHh) ||
      isoToHhmmInstitucional(egresoIso) ||
      toHhmmInstitucionalDisplay(capa.egreso) ||
      toHhmmInstitucionalDisplay(capa.egreso_teorico_final);

  if (!esFranco && ingreso && egreso && !ingresoIso) {
    const cruza =
      res.turno_teorico?.cruza_medianoche === true ||
      String(egreso) <= String(ingreso);
    ingresoIso = ymdHoraToIso(fechaYmd, ingreso, 0);
    egresoIso = ymdHoraToIso(fechaYmd, egreso, cruza ? 1 : 0);
  }

  const esFeriado = capa.es_feriado === true || res.es_feriado === true;

  return {
    tipo_dia: tipo,
    turno_id: esFranco ? null : turnoId,
    ingreso,
    egreso,
    ingreso_iso: esFranco ? null : ingresoIso,
    egreso_iso: esFranco ? null : egresoIso,
    es_feriado: esFeriado,
    tipo_evento_institucional: esFeriado ? res.tipo_evento || "feriado" : null,
  };
}

async function cargarRegimen(regimenId, cache) {
  const id = String(regimenId || "").trim();
  if (!id) return null;
  if (cache.has(id)) return cache.get(id);
  const snap = await db.collection(COL_REGIMEN).doc(id).get();
  const doc = snap.exists ? snap.data() : null;
  cache.set(id, doc);
  return doc;
}

/**
 * @param {{ periodo: string, planId: string, agentes: object[] }} params
 * @returns {Promise<object[]>}
 */
async function enriquecerAgentesDiasPlan({ periodo, planId, agentes }) {
  const agentesIn = Array.isArray(agentes) ? agentes : [];
  if (!periodo || agentesIn.length === 0) return [];

  const [anio, mes] = periodo.split("-").map(Number);
  const ymdsMes = diasDelMes(anio, mes);
  if (ymdsMes.length === 0) return [];

  const indiceCalendario = await getIndiceCalendario();
  const regimenCache = new Map();
  const planData = {
    planId: planId || "draft",
    plan: { agentes: agentesIn },
  };
  const agentesOut = [];

  for (const ag of agentesIn) {
    if (!ag?.persona_id || !ag?.regimen_horario_id) continue;
    const regimen = await cargarRegimen(ag.regimen_horario_id, regimenCache);
    if (!regimen) continue;

    let hlg = { regimen_fecha_ancla: ag.regimen_fecha_ancla || null };
    if (ag.hlg_id) {
      const hlgSnap = await db.collection(COL_HLG).doc(ag.hlg_id).get();
      if (hlgSnap.exists) {
        hlg = { id: hlgSnap.id, ...hlgSnap.data() };
      }
    }

    const diasIn = sanitizarDiasPlanSegunVigenciaHlg(
      ag.dias && typeof ag.dias === "object" ? ag.dias : {},
      hlg.id ? hlg : null,
    );
    const ymds = new Set([...ymdsMes, ...Object.keys(diasIn)]);
    const diasMap = {};

    for (const fechaYmd of ymds) {
      const raw = diasIn[fechaYmd] || {};
      const res = resolverDiaConPreCarga(
        regimen,
        fechaYmd,
        hlg,
        planData,
        ag.persona_id,
        indiceCalendario,
      );

      const tipoUsuario = raw.tipo_dia != null ? normalizarTipoDia(raw.tipo_dia) : null;
      const tipo_dia = tipoUsuario || normalizarTipoDia(res.tipo_dia);
      let turnoCompuestoId =
        raw.turno_id != null && String(raw.turno_id).trim() !== ""
          ? String(raw.turno_id).trim()
          : res.turno_teorico?.turno_id || null;

      if (tipo_dia === "franco" || tipo_dia === "no_laborable") {
        turnoCompuestoId = null;
      }

      const capa = buildCapaTeoricaSegmentada({
        fechaYmd,
        personaId: ag.persona_id,
        regimen,
        tipo_dia,
        turnoCompuestoId,
        origen_segmento: "plan_base",
        indiceCalendario,
      });
      if (res.es_feriado) capa.es_feriado = true;

      const celda = celdaPlanDesdeResolucion(
        fechaYmd,
        {
          ...res,
          tipo_dia,
          turno_teorico: turnoCompuestoId
            ? { ...(res.turno_teorico || {}), turno_id: turnoCompuestoId }
            : res.turno_teorico,
        },
        capa,
      );
      diasMap[fechaYmd] = celda;
    }

    agentesOut.push({
      persona_id: ag.persona_id,
      regimen_horario_id: ag.regimen_horario_id,
      hlg_id: ag.hlg_id,
      dias: diasMap,
    });
  }

  return agentesOut;
}

function celdaPlanToGrillaAprobada(celdaPlan, capa) {
  const tipo = normalizarTipoDia(celdaPlan.tipo_dia);
  const esFranco = tipo === "franco" || tipo === "no_laborable";
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  return {
    ...celdaPlan,
    tipo_dia: tipo,
    turno_id: esFranco ? null : celdaPlan.turno_id,
    turno_compuesto_id: esFranco ? null : celdaPlan.turno_id,
    es_franco: esFranco,
    clasificacion_dia_calendario_id: capa.clasificacion_dia_calendario_id || null,
    fichadas_esperadas: typeof capa.fichadas_esperadas === "number" ? capa.fichadas_esperadas : null,
    segmentos: segmentos.map((s) => ({
      segmento_id: s.segmento_id,
      ingreso_iso: s.ingreso_iso,
      egreso_iso: s.egreso_iso,
    })),
  };
}

/**
 * Snapshot grilla_aprobada desde la foto ya persistida en plan.agentes[].dias.
 */
async function construirGrillaAprobadaDesdePlanFoto({ plan, planId }) {
  if (!plan || plan.tipo_plan !== "mensual" || !plan.periodo) return null;
  const agentesIn = Array.isArray(plan.agentes) ? plan.agentes : [];
  if (agentesIn.length === 0) return null;

  const agentesEnriquecidos = await enriquecerAgentesDiasPlan({
    periodo: plan.periodo,
    planId: planId || plan.id,
    agentes: agentesIn,
  });
  if (agentesEnriquecidos.length === 0) return null;

  const [anio, mes] = plan.periodo.split("-").map(Number);
  const ymdsMes = diasDelMes(anio, mes);
  const indiceCalendario = await getIndiceCalendario();
  const regimenCache = new Map();
  const planData = { planId: planId || plan.id, plan: { agentes: agentesIn } };
  const agentesOut = [];

  for (const agBase of agentesEnriquecidos) {
    const agIn = agentesIn.find((a) => a.persona_id === agBase.persona_id) || agBase;
    const regimen = await cargarRegimen(agBase.regimen_horario_id, regimenCache);
    if (!regimen) continue;

    let hlg = { regimen_fecha_ancla: agIn.regimen_fecha_ancla || null };
    if (agIn.hlg_id) {
      const hlgSnap = await db.collection(COL_HLG).doc(agIn.hlg_id).get();
      if (hlgSnap.exists) hlg = { id: hlgSnap.id, ...hlgSnap.data() };
    }

    const diasMap = {};
    for (const fechaYmd of ymdsMes) {
      const celdaPlan = agBase.dias?.[fechaYmd];
      if (!celdaPlan) continue;
      const res = resolverDiaConPreCarga(
        regimen,
        fechaYmd,
        hlg,
        planData,
        agBase.persona_id,
        indiceCalendario,
      );
      const tipo_dia = normalizarTipoDia(celdaPlan.tipo_dia || res.tipo_dia);
      let turnoCompuestoId = celdaPlan.turno_id || res.turno_teorico?.turno_id || null;
      if (tipo_dia === "franco" || tipo_dia === "no_laborable") turnoCompuestoId = null;

      const capa = buildCapaTeoricaSegmentada({
        fechaYmd,
        personaId: agBase.persona_id,
        regimen,
        tipo_dia,
        turnoCompuestoId,
        origen_segmento: "plan_base",
        indiceCalendario,
      });
      if (celdaPlan.es_feriado === true || res.es_feriado) capa.es_feriado = true;

      diasMap[fechaYmd] = celdaPlanToGrillaAprobada(celdaPlan, capa);
    }

    agentesOut.push({
      persona_id: agBase.persona_id,
      regimen_horario_id: agBase.regimen_horario_id,
      hlg_id: agBase.hlg_id,
      dias: diasMap,
    });
  }

  return agentesOut;
}

module.exports = {
  enriquecerAgentesDiasPlan,
  normalizarTipoDia,
  celdaPlanDesdeResolucion,
  celdaPlanToGrillaAprobada,
  construirGrillaAprobadaDesdePlanFoto,
};
