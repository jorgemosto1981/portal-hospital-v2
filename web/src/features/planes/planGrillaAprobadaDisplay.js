/**
 * Etiquetas de celda desde grilla_aprobada (snapshot del plan HABILITADO).
 */

import {
  resolverHorarioCelda,
  rangoHhmmLabel,
} from "../../../../shared/utils/horarioInstitucionalDisplay.js";

function horarioDesdeCelda(celda) {
  const { ingreso, egreso } = resolverHorarioCelda(celda);
  return rangoHhmmLabel(ingreso, egreso);
}

export function etiquetaCeldaAprobada(celda) {
  if (!celda || typeof celda !== "object") return "";
  if (celda.es_franco || celda.tipo_dia === "franco" || celda.tipo_dia === "no_laborable") return "F";
  if (
    (celda.es_feriado || celda.tipo_evento_institucional === "feriado" || celda.tipo_evento_institucional === "asueto") &&
    !celda.turno_id &&
    !celda.turno_compuesto_id
  ) {
    return celda.tipo_evento_institucional === "asueto" ? "Asu" : "Fer";
  }
  const turno = String(celda.turno_id || celda.turno_compuesto_id || "").trim();
  const horario = horarioDesdeCelda(celda);
  if (turno && horario) return `${turno} ${horario}`;
  if (turno) return turno;
  if (horario) return horario;
  return "";
}

export function claseCeldaAprobada(celda) {
  if (!celda || typeof celda !== "object") return "bg-white";
  if (celda.es_franco || celda.tipo_dia === "franco" || celda.tipo_dia === "no_laborable") {
    return "bg-slate-100 text-slate-700";
  }
  const esInstitucional =
    celda.es_feriado === true ||
    celda.tipo_evento_institucional === "feriado" ||
    celda.tipo_evento_institucional === "asueto";
  if (esInstitucional) return "bg-amber-100 text-amber-900";
  if (celda.turno_id || celda.turno_compuesto_id) return "bg-emerald-50 text-emerald-900";
  return "bg-white";
}

export function columnasDesdeGrillaAprobada(grillaAprobada) {
  const set = new Set();
  for (const ag of grillaAprobada?.agentes || []) {
    const dias = ag?.dias && typeof ag.dias === "object" ? Object.keys(ag.dias) : [];
    dias.forEach((d) => set.add(d));
  }
  if (grillaAprobada?.periodo) {
    const m = /^(\d{4})-(\d{2})$/.exec(grillaAprobada.periodo);
    if (m) {
      const anio = Number(m[1]);
      const mes = Number(m[2]);
      const total = new Date(anio, mes, 0).getDate();
      for (let d = 1; d <= total; d += 1) {
        set.add(`${grillaAprobada.periodo}-${String(d).padStart(2, "0")}`);
      }
    }
  }
  return [...set].sort();
}
