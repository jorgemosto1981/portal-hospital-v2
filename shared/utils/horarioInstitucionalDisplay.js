/**
 * Presentación de horarios en zona institucional (Argentina).
 * Lógica temporal: usar siempre ingreso_iso / egreso_iso.
 */

export const ZONA_HORARIA_INSTITUCIONAL = "America/Argentina/Buenos_Aires";

/**
 * @param {string|null|undefined} iso
 * @returns {string|null} HH:mm en calendario AR
 */
export function isoToHhmmInstitucional(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA_INSTITUCIONAL,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value;
  const mm = parts.find((p) => p.type === "minute")?.value;
  if (!hh || !mm) return null;
  return `${hh}:${mm}`;
}

/**
 * @param {string|null|undefined} val
 * @returns {string|null}
 */
export function toHhmmInstitucionalDisplay(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return isoToHhmmInstitucional(s);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  return null;
}

/**
 * @param {string|null|undefined} ingresoHhmm
 * @param {string|null|undefined} egresoHhmm
 * @returns {string}
 */
export function rangoHhmmLabel(ingresoHhmm, egresoHhmm) {
  const ing = toHhmmInstitucionalDisplay(ingresoHhmm);
  const egr = toHhmmInstitucionalDisplay(egresoHhmm);
  if (!ing && !egr) return "";
  if (ing && egr) {
    const hi = ing.split(":")[0];
    const he = egr.split(":")[0];
    if (ing.endsWith(":00") && egr.endsWith(":00")) return `${hi}-${he}`;
    return `${ing}-${egr}`;
  }
  return ing || egr || "";
}

/**
 * @param {object|null|undefined} celda
 * @returns {{ ingreso: string|null, egreso: string|null }}
 */
export function resolverHorarioCelda(celda) {
  if (!celda || typeof celda !== "object") return { ingreso: null, egreso: null };
  const ingreso =
    toHhmmInstitucionalDisplay(celda.ingreso) || isoToHhmmInstitucional(celda.ingreso_iso);
  const egreso =
    toHhmmInstitucionalDisplay(celda.egreso) || isoToHhmmInstitucional(celda.egreso_iso);
  return { ingreso, egreso };
}

/**
 * Horario por tramos solo cuando la jornada tiene discontinuidad (`tiene_huecos`).
 * Compuesto continuo (M+T, M+T+N) → null: la UI usa el sobre ingreso–egreso.
 * Discontinuo (p. ej. M+N con hueco 14–22) → "06:00–14:00 · 22:00–06:00".
 * @param {{
 *   segmentos?: Array<{ ingreso_iso?: string; egreso_iso?: string; ingreso?: string; egreso?: string }>;
 *   tiene_huecos?: boolean;
 *   compact?: boolean;
 * }} opts
 * @returns {string|null}
 */
export function horarioDisplayDesdeSegmentos(opts = {}) {
  const seg = Array.isArray(opts.segmentos) ? opts.segmentos : [];
  if (seg.length <= 1 || opts.tiene_huecos !== true) return null;

  const compact = opts.compact === true;
  const tramos = seg
    .map((s) => {
      const ing = toHhmmInstitucionalDisplay(s.ingreso) || isoToHhmmInstitucional(s.ingreso_iso);
      const egr = toHhmmInstitucionalDisplay(s.egreso) || isoToHhmmInstitucional(s.egreso_iso);
      if (!ing || !egr) return "";
      return compact ? rangoHhmmLabel(ing, egr) : `${ing}–${egr}`;
    })
    .filter(Boolean);

  if (!tramos.length) return null;
  return tramos.join(" · ");
}

/**
 * @param {object|null|undefined} capa
 * @param {string|null|undefined} [ingresoEnvelope]
 * @param {string|null|undefined} [egresoEnvelope]
 * @param {boolean} [compact]
 * @returns {string|null}
 */
export function horarioDisplayDesdeCapaTeorica(capa, ingresoEnvelope, egresoEnvelope, compact = false) {
  if (!capa || typeof capa !== "object") return null;
  if (capa.tiene_huecos === true) {
    const pre = String(capa.horario_display || capa.rda_horario_display || "").trim();
    if (pre) return pre;
    return horarioDisplayDesdeSegmentos({
      segmentos: capa.segmentos,
      tiene_huecos: true,
      compact,
    });
  }
  return null;
}

/**
 * @param {object|null|undefined} cell — celda vis_* o capa mínima para UI
 * @param {boolean} [compact]
 * @returns {string}
 */
export function horarioOperativoDesdeCeldaVis(cell, compact = false) {
  if (!cell || typeof cell !== "object") return "";
  const tieneHuecos = cell.rda_tiene_huecos === true || cell.tiene_huecos === true;

  if (tieneHuecos) {
    const display = String(cell.rda_horario_display || cell.horario_display || "").trim();
    if (display) return display;
    const porSegmentos = horarioDisplayDesdeSegmentos({
      segmentos: cell.segmentos || cell.rda_segmentos,
      tiene_huecos: true,
      compact,
    });
    if (porSegmentos) return porSegmentos;
  }

  const ing = String(cell.rda_ingreso || cell.ingreso || "").trim();
  const egr = String(cell.rda_egreso || cell.egreso || "").trim();
  if (ing && egr) return compact ? rangoHhmmLabel(ing, egr) : `${ing}–${egr}`;
  if (ing) return ing;
  return "";
}
