"use strict";

/**
 * Construye grilla_aprobada en memoria (misma lógica que materialización, sin lecturas a asi_*).
 * @see docs/v2/RFC_GRILLA_APROBADA_PLAN_TURNO_V2.md
 */

const { db } = require("../shared/context");
const { getIndiceCalendario } = require("../shared/calendarService");
const { buildCapaTeoricaSegmentada } = require("./capaTeoricaSegmentosCore");
const { resolverDiaConPreCarga, diasDelMes } = require("./rdaTurnoTeoricoWorker");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";

function celdaDesdeCapa(resolucion, capa) {
  const tipo = capa.tipo_dia || resolucion.tipo_dia || "no_laborable";
  const esFranco = tipo === "franco" || tipo === "no_laborable";
  const turnoId =
    capa.turno_compuesto_id ||
    resolucion.turno_teorico?.turno_id ||
    null;
  const segmentos = Array.isArray(capa.segmentos) ? capa.segmentos : [];
  return {
    tipo_dia: tipo,
    turno_id: esFranco ? null : turnoId,
    turno_compuesto_id: esFranco ? null : (capa.turno_compuesto_id || turnoId),
    ingreso: esFranco ? null : (capa.ingreso_teorico_final || resolucion.turno_teorico?.ingreso || null),
    egreso: esFranco ? null : (capa.egreso_teorico_final || resolucion.turno_teorico?.egreso || null),
    ingreso_iso: segmentos[0]?.ingreso_iso || null,
    egreso_iso: segmentos.length ? segmentos[segmentos.length - 1].egreso_iso : null,
    es_franco: esFranco,
    es_feriado: capa.es_feriado === true || resolucion.es_feriado === true,
    clasificacion_dia_calendario_id: capa.clasificacion_dia_calendario_id || null,
    fichadas_esperadas: typeof capa.fichadas_esperadas === "number" ? capa.fichadas_esperadas : null,
    segmentos: segmentos.map((s) => ({
      segmento_id: s.segmento_id,
      ingreso_iso: s.ingreso_iso,
      egreso_iso: s.egreso_iso,
    })),
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
 * @param {{ plan: object, planId: string }} params
 * @returns {Promise<object|null>}
 */
async function construirGrillaAprobada({ plan, planId }) {
  if (!plan || plan.tipo_plan !== "mensual" || !plan.periodo) return null;
  const agentesIn = Array.isArray(plan.agentes) ? plan.agentes : [];
  if (agentesIn.length === 0) return null;

  const [anio, mes] = plan.periodo.split("-").map(Number);
  const dias = diasDelMes(anio, mes);
  if (dias.length === 0) return null;

  const indiceCalendario = await getIndiceCalendario();
  const regimenCache = new Map();
  const planData = { planId, plan };
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

    const diasMap = {};
    for (const fechaYmd of dias) {
      const res = resolverDiaConPreCarga(
        regimen,
        fechaYmd,
        hlg,
        planData,
        ag.persona_id,
        indiceCalendario,
      );
      const turnoCompuestoId = res.turno_teorico?.turno_id || ag.dias?.[fechaYmd]?.turno_id || null;
      const capa = buildCapaTeoricaSegmentada({
        fechaYmd,
        personaId: ag.persona_id,
        regimen,
        tipo_dia: res.tipo_dia,
        turnoCompuestoId,
        origen_segmento: "plan_base",
        indiceCalendario,
      });
      if (res.es_feriado) capa.es_feriado = true;
      diasMap[fechaYmd] = celdaDesdeCapa(res, capa);
    }

    agentesOut.push({
      persona_id: ag.persona_id,
      regimen_horario_id: ag.regimen_horario_id,
      hlg_id: ag.hlg_id || null,
      dias: diasMap,
    });
  }

  return {
    version: 1,
    periodo: plan.periodo,
    grupo_id: plan.grupo_id || null,
    materializado_en: new Date().toISOString(),
    agentes: agentesOut,
  };
}

module.exports = { construirGrillaAprobada, celdaDesdeCapa };
