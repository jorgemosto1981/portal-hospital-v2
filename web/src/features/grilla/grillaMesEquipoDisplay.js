/**
 * Presentación de celdas en grilla equipo (calendario licencias).
 */

import {
  claseHeaderColumna,
  claseTdColumna,
  varianteCeldaOperativa,
} from "./grillaTurnosVisual.js";

export { claseHeaderColumna as claseFondoColumna, claseTdColumna as claseFondoCelda, varianteCeldaOperativa };

/** @param {number} anio @param {number} mes */
export function columnasCalendario(anio, mes) {
  const totalDias = new Date(anio, mes, 0).getDate();
  const DIAS_SEMANA_CORTO = ["D", "L", "M", "X", "J", "V", "S"];
  return Array.from({ length: totalDias }, (_, i) => {
    const num = i + 1;
    const ds = new Date(anio, mes - 1, num).getDay();
    return {
      num,
      dia: String(num).padStart(2, "0"),
      letra: DIAS_SEMANA_CORTO[ds],
      esFinde: ds === 0 || ds === 6,
    };
  });
}

/**
 * Feriado/asueto por día (cualquier agente del mes marca la columna).
 * @param {Array<{ dias?: Record<string, object> }>} filas
 * @param {number} totalDias
 * @returns {Record<string, string|null>} dia → tipo_evento o null
 */
export function institucionalPorDiaEnFilas(filas, totalDias) {
  const out = {};
  for (let d = 1; d <= totalDias; d += 1) {
    out[String(d).padStart(2, "0")] = null;
  }
  for (const fila of filas || []) {
    const dias = fila.dias && typeof fila.dias === "object" ? fila.dias : {};
    for (const [diaKey, cell] of Object.entries(dias)) {
      const dia = /^\d{2}$/.test(diaKey) ? diaKey : diaKey.slice(-2);
      if (!out[dia] && cell && typeof cell === "object") {
        const tipo = cell.tipo_evento_institucional || null;
        if (cell.es_feriado === true || tipo === "feriado" || tipo === "asueto") {
          out[dia] = tipo || "feriado";
        }
      }
    }
  }
  return out;
}

function normalizarTipoDiaVis(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (t === "no_laborable" || t === "no-laborable" || t === "nolaborable") return "no_laborable";
  if (t === "franco") return "franco";
  return t;
}

/**
 * US-1 / escenario C: laborable|guardia en capa 1 sin rda_* ni horario visible.
 * @param {object|null|undefined} cell
 */
export function celdaEsIncompletoPlanVis(cell) {
  if (!cell || typeof cell !== "object") return false;
  const tipo = normalizarTipoDiaVis(cell.tipo_dia);
  if (tipo !== "laborable" && tipo !== "guardia") return false;
  if (cell.es_franco === true || tipo === "franco" || tipo === "no_laborable") return false;
  return !celdaTieneJornadaVis(cell);
}

/** Jornada en vis_* (incluye turno en feriado aunque tipo_dia sea no_laborable). */
export function celdaTieneJornadaVis(cell) {
  if (!cell || typeof cell !== "object") return false;
  const ing = String(cell.rda_ingreso || "").trim();
  const egr = String(cell.rda_egreso || "").trim();
  if (ing || egr) return true;
  const tid = String(cell.rda_turno_id || "").trim();
  return Boolean(tid);
}

/** @param {object} cell */
export function textoHorarioTurno(cell) {
  if (!cell || typeof cell !== "object") return "";
  const tipo = normalizarTipoDiaVis(cell.tipo_dia);
  const tieneJornada = celdaTieneJornadaVis(cell);
  if (tipo === "no_laborable" && !tieneJornada) return "NL";
  if ((cell.es_franco === true || tipo === "franco") && !tieneJornada) return "F";
  const ing = String(cell.rda_ingreso || "").trim();
  const egr = String(cell.rda_egreso || "").trim();
  if (ing && egr) return `${ing}–${egr}`;
  if (ing) return ing;
  const tid = String(cell.rda_turno_id || "").trim();
  return tid;
}
