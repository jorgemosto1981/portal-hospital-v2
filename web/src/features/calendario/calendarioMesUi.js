/**
 * Helpers de grilla mes (calendario institucional).
 * Zona horaria: America/Argentina/Buenos_Aires.
 */

/** Domingo primero: D L M M J V S */
export const DIAS_SEMANA_CAL = ["D", "L", "M", "M", "J", "V", "S"];

/** Ventana de consulta agente: 2 meses atrás … 2 meses adelante. */
export const OFFSETS_MES_CONSULTA = Object.freeze([-2, -1, 0, 1, 2]);

/**
 * @param {string} [hoyYmd] YYYY-MM-DD en BA
 * @returns {{ year: number, month: number }}
 */
export function mesActualBa(hoyYmd) {
  const s =
    typeof hoyYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hoyYmd)
      ? hoyYmd
      : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return { year: Number(s.slice(0, 4)), month: Number(s.slice(5, 7)) };
}

/**
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} deltaMes
 * @returns {{ year: number, month: number }}
 */
export function sumarMeses(year, month, deltaMes) {
  const idx = year * 12 + (month - 1) + Math.floor(Number(deltaMes) || 0);
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/**
 * @param {number} year
 * @param {number} month 1–12
 */
export function labelMesCorto(year, month) {
  const nombre = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("es-AR", {
    month: "short",
    timeZone: "UTC",
  });
  const short = String(nombre || "").replace(/\.$/, "").trim();
  return `${short} ${String(year).slice(2)}`;
}

/**
 * @param {number} year
 * @param {number} month 1–12
 */
export function labelMesLargo(year, month) {
  return new Date(year, month - 1, 1).toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {number} [anclaYear]
 * @param {number} [anclaMonth]
 * @returns {Array<{ offset: number, year: number, month: number, label: string }>}
 */
export function ventanaMesesConsulta(anclaYear, anclaMonth) {
  const base =
    anclaYear != null && anclaMonth != null
      ? { year: anclaYear, month: anclaMonth }
      : mesActualBa();
  return OFFSETS_MES_CONSULTA.map((offset) => {
    const { year, month } = sumarMeses(base.year, base.month, offset);
    return { offset, year, month, label: labelMesCorto(year, month) };
  });
}

function ymdFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Celdas del mes (null = padding). Domingo = inicio de semana. */
export function celdasMesCalendario(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = first.getUTCDay();
  const cells = [];
  for (let i = 0; i < start; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(ymdFromParts(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Quita estados hover (consulta táctil / solo lectura). */
export function colorClassSinHover(colorClass) {
  return String(colorClass || "")
    .split(/\s+/)
    .filter((c) => c && !c.startsWith("hover:"))
    .join(" ");
}
