/**
 * Presentación de celdas en grilla equipo (calendario licencias).
 */

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

/** @param {object} cell */
export function textoHorarioTurno(cell) {
  if (!cell || typeof cell !== "object") return "";
  if (cell.es_franco === true) return "F";
  const ing = String(cell.rda_ingreso || "").trim();
  const egr = String(cell.rda_egreso || "").trim();
  if (ing && egr) return `${ing}–${egr}`;
  if (ing) return ing;
  const tid = String(cell.rda_turno_id || "").trim();
  return tid;
}

/** @param {string|null} tipoInstitucional */
export function etiquetaInstitucional(tipoInstitucional) {
  if (tipoInstitucional === "feriado") return "FER";
  if (tipoInstitucional === "asueto") return "ASU";
  if (tipoInstitucional) return "INST";
  return "FER";
}

export function claseFondoColumna({ esFinde, tipoInstitucional }) {
  if (tipoInstitucional) return "bg-amber-100 text-amber-900";
  if (esFinde) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export function claseFondoCelda({ esFinde, tipoInstitucional, tieneLicencia, esFranco, tieneTurno }) {
  if (tipoInstitucional) return "bg-amber-50";
  if (esFranco && !tieneTurno && !tieneLicencia) return "bg-slate-50";
  if (tieneTurno && !tieneLicencia) return "bg-indigo-50/80";
  if (esFinde && !tieneLicencia && !tieneTurno) return "bg-rose-50/40";
  return "bg-white";
}
