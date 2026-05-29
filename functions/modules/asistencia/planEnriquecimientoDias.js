"use strict";

/**
 * Enriquece agentes[].dias del plan mensual al guardar (foto teórica en borrador).
 * Usa regímenes, calendario institucional y la misma resolución que grilla_aprobada.
 */

const { db } = require("../shared/context");
const { getIndiceCalendario } = require("../shared/calendarService");
const { buildCapaTeoricaSegmentada, ymdHoraToIso } = require("./capaTeoricaSegmentosCore");
const { resolverDiaConPreCarga, diasDelMes } = require("./rdaTurnoTeoricoWorker");

const COL_HLG = "historial_laboral_grupos";
const COL_REGIMEN = "cfg_regimen_horario";

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

function isoToHhmmAr(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value;
  const mm = parts.find((p) => p.type === "minute")?.value;
  if (!hh || !mm) return null;
  return `${hh}:${mm}`;
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

/** Solo HH:mm civil AR; nunca persistir ISO en ingreso/egreso de display. */
function toHhmmArDisplay(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return isoToHhmmAr(s);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  return null;
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
    : toHhmmArDisplay(ingHh) ||
      isoToHhmmAr(ingresoIso) ||
      toHhmmArDisplay(capa.ingreso) ||
      toHhmmArDisplay(capa.ingreso_teorico_final);
  let egreso = esFranco
    ? null
    : toHhmmArDisplay(egrHh) ||
      isoToHhmmAr(egresoIso) ||
      toHhmmArDisplay(capa.egreso) ||
      toHhmmArDisplay(capa.egreso_teorico_final);

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

    const diasIn = ag.dias && typeof ag.dias === "object" ? ag.dias : {};
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

module.exports = { enriquecerAgentesDiasPlan, normalizarTipoDia };
