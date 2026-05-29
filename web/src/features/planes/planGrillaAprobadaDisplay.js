/**
 * Estilos y columnas para grilla_aprobada (vistas VER).
 */

import {
  normalizarTipoDiaCelda,
  presentacionCeldaGrillaAprobada,
} from "./planGrillaCeldaDisplay.js";

export { normalizarTipoDiaCelda, presentacionCeldaGrillaAprobada };

export function etiquetaCeldaAprobada(celda, opts = {}) {
  return presentacionCeldaGrillaAprobada(celda, opts).unaLinea;
}

export function claseCeldaAprobada(celda) {
  if (!celda || typeof celda !== "object") return "bg-white";
  const tipo = normalizarTipoDiaCelda(celda.tipo_dia);
  if (celda.es_franco || tipo === "franco" || tipo === "no_laborable") {
    return "bg-slate-100 text-slate-700";
  }
  if (celda.es_feriado) return "bg-amber-100 text-amber-900";
  if (celda.turno_id || celda.turno_compuesto_id) return "bg-emerald-50 text-emerald-900";
  const { ingreso, egreso } = celda;
  if (ingreso || egreso || celda.ingreso_iso || celda.egreso_iso) {
    return "bg-sky-50 text-sky-900";
  }
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
