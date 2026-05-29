/**
 * Completa celdas vis_* con teorico del plan HABILITADO (grilla_aprobada)
 * cuando la materialización operativa quedó incompleta.
 */

import { resolverHorarioCelda } from "../../../../shared/utils/horarioInstitucionalDisplay.js";

function normalizarTipo(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t === "laborable" || t === "guardia" || t === "franco" || t === "no_laborable") return t;
  return null;
}

function dia02DesdeClave(diaKey) {
  const s = String(diaKey || "").trim();
  if (/^\d{2}$/.test(s)) return s;
  const m = /-(\d{2})$/.exec(s);
  return m ? m[1] : s.slice(-2);
}

function buscarCeldaAprobada(agente, periodo, dia02) {
  const dias = agente?.dias && typeof agente.dias === "object" ? agente.dias : {};
  const ymd = `${periodo}-${dia02}`;
  return dias[ymd] || dias[dia02] || null;
}

function tieneHorarioVis(cell) {
  return Boolean(String(cell?.rda_ingreso || "").trim() && String(cell?.rda_egreso || "").trim());
}

/**
 * @param {object} cellVis
 * @param {object|null} celdaApr
 */
export function enriquecerCeldaVisConAprobada(cellVis, celdaApr) {
  const out = { ...(cellVis && typeof cellVis === "object" ? cellVis : {}) };
  if (!celdaApr || typeof celdaApr !== "object") return out;

  const tipoApr = normalizarTipo(celdaApr.tipo_dia);
  const tipoVis = normalizarTipo(out.tipo_dia);
  const { ingreso: ingApr, egreso: egrApr } = resolverHorarioCelda(celdaApr);
  const horarioApr = Boolean(ingApr && egrApr);
  const horarioVis = tieneHorarioVis(out);
  const esLaboralApr = tipoApr === "laborable" || tipoApr === "guardia";

  if (horarioApr && esLaboralApr && !horarioVis) {
    out.tipo_dia = tipoApr;
    out.es_franco = false;
    out.rda_ingreso = ingApr;
    out.rda_egreso = egrApr;
    const tid = String(celdaApr.turno_id || celdaApr.turno_compuesto_id || "").trim();
    if (tid) out.rda_turno_id = tid;
    return out;
  }

  if (!horarioVis && tipoApr && tipoApr !== tipoVis) {
    out.tipo_dia = tipoApr;
    out.es_franco = tipoApr === "franco";
    if (tipoApr === "franco" || tipoApr === "no_laborable") {
      out.rda_ingreso = null;
      out.rda_egreso = null;
      out.rda_turno_id = null;
    }
  }

  return out;
}

/**
 * @param {Array<{ persona_id: string, dias?: Record<string, object> }>} filas
 * @param {object|null|undefined} grillaAprobada
 * @param {string} periodo YYYY-MM
 */
export function enriquecerFilasConGrillaAprobada(filas, grillaAprobada, periodo) {
  const agentes = Array.isArray(grillaAprobada?.agentes) ? grillaAprobada.agentes : [];
  if (!agentes.length || !periodo) return filas;

  const porPersona = new Map();
  for (const ag of agentes) {
    const pid = String(ag?.persona_id || "").trim();
    if (pid) porPersona.set(pid, ag);
  }

  return (filas || []).map((fila) => {
    const ag = porPersona.get(String(fila.persona_id || "").trim());
    if (!ag) return fila;
    const diasVis = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
    const diasOut = { ...diasVis };
    for (const [diaKey, cell] of Object.entries(diasVis)) {
      const dia02 = dia02DesdeClave(diaKey);
      diasOut[diaKey] = enriquecerCeldaVisConAprobada(cell, buscarCeldaAprobada(ag, periodo, dia02));
    }
    return { ...fila, dias: diasOut };
  });
}
