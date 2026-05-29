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
 * Franco (asignado en plan/ciclo) vs no_laborable (régimen: sáb/dom u otro patrón fijo).
 * @param {object|null|undefined} cell
 * @returns {"franco"|"no_laborable"|null}
 */
export function resolverTipoDiaCelda(cell) {
  if (!cell || typeof cell !== "object") return null;
  const t = String(cell.tipo_dia || "").trim().toLowerCase();
  if (t === "franco") return "franco";
  if (t === "no_laborable") return "no_laborable";
  if (cell.es_feriado === true && t !== "franco") return "no_laborable";
  if (t === "laborable" || t === "guardia") return null;
  if (cell.es_franco === true) return "franco";
  return null;
}

/** @param {object} cell */
export function tieneHorarioTeorico(cell) {
  if (!cell || typeof cell !== "object") return false;
  return Boolean(String(cell.rda_ingreso || "").trim() && String(cell.rda_egreso || "").trim());
}

/**
 * @param {"franco"|"no_laborable"|null} tipoDia
 */
export function etiquetaTipoDia(tipoDia) {
  if (tipoDia === "franco") return "F";
  if (tipoDia === "no_laborable") return "NL";
  return "";
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
  const ing = String(cell.rda_ingreso || "").trim();
  const egr = String(cell.rda_egreso || "").trim();
  const tipoDia = resolverTipoDiaCelda(cell);
  if (ing && egr && tipoDia !== "franco" && tipoDia !== "no_laborable") {
    return `${ing}–${egr}`;
  }
  const etiqueta = etiquetaTipoDia(tipoDia);
  if (etiqueta) return etiqueta;
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

export function claseFondoCelda({ esFinde, tipoInstitucional, tieneLicencia, tipoDia, tieneTurno }) {
  if (tipoInstitucional) return "bg-amber-50";
  if (tieneTurno && !tieneLicencia) return "bg-indigo-100";
  if (tipoDia === "franco") return esFinde ? "bg-teal-100 ring-1 ring-inset ring-rose-200" : "bg-teal-100";
  if (tipoDia === "no_laborable") return esFinde ? "bg-zinc-200 ring-1 ring-inset ring-rose-200" : "bg-zinc-200";
  if (esFinde && !tieneLicencia && !tieneTurno) return "bg-rose-100";
  return "bg-white";
}

/** Fondo explícito: el UA style del <button> tapa clases Tailwind suaves. */
const FONDO_CELDA_HEX = {
  "bg-amber-50": "#fffbeb",
  "bg-indigo-100": "#e0e7ff",
  "bg-teal-100": "#ccfbf1",
  "bg-zinc-200": "#e4e4e7",
  "bg-rose-100": "#ffe4e6",
  "bg-white": "#ffffff",
};

/**
 * @param {Parameters<typeof claseFondoCelda>[0]} params
 * @returns {{ className: string, style: { backgroundColor: string } }}
 */
export function estiloFondoCelda(params) {
  const className = claseFondoCelda(params);
  const base = className.split(" ").find((c) => FONDO_CELDA_HEX[c]) || "bg-white";
  return {
    className,
    style: { backgroundColor: FONDO_CELDA_HEX[base] || "#ffffff" },
  };
}

export function claseTextoTipoDia(tipoDia) {
  if (tipoDia === "franco") return "font-bold text-teal-800";
  if (tipoDia === "no_laborable") return "font-semibold text-zinc-500";
  return "font-semibold text-slate-800";
}

export function tituloTipoDia(tipoDia) {
  if (tipoDia === "franco") return "Franco (asignado en plan o ciclo)";
  if (tipoDia === "no_laborable") return "Día no laborable del régimen";
  return "";
}
