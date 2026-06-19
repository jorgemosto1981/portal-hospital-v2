"use strict";
// AUTO-GENERADO por scripts/sync-shared-to-functions.mjs
// NO EDITAR MANUALMENTE — editar shared/utils/ y correr el script.


/**
 * Presentación de horarios en zona institucional (Argentina).
 * Lógica temporal: usar siempre ingreso_iso / egreso_iso.
 */

const ZONA_HORARIA_INSTITUCIONAL = "America/Argentina/Buenos_Aires";

/**
 * @param {string|null|undefined} iso
 * @returns {string|null} HH:mm en calendario AR
 */
function isoToHhmmInstitucional(iso) {
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
function toHhmmInstitucionalDisplay(val) {
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
function rangoHhmmLabel(ingresoHhmm, egresoHhmm) {
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
function resolverHorarioCelda(celda) {
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
function horarioDisplayDesdeSegmentos(opts = {}) {
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
function horarioDisplayDesdeCapaTeorica(capa, ingresoEnvelope, egresoEnvelope, compact = false) {
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
 * Compuestos sin discontinuidad en régimen internación (M→T→N encadenados).
 * @param {string} turnoId
 */
function esCompuestoContinuoEstandar(turnoId) {
  const t = String(turnoId || "").trim();
  if (!t.includes("+")) return false;
  if (t === "M+T" || t === "M+T+N" || t === "T+N") return true;
  const parts = t.split("+").map((x) => x.trim()).filter(Boolean);
  const cadena = ["M", "T", "N"];
  let last = -1;
  for (const p of parts) {
    const idx = cadena.indexOf(p);
    if (idx < 0) return false;
    if (idx < last) return false;
    last = idx;
  }
  return parts.length >= 2 && parts.includes("T");
}

/**
 * @param {object[]} segmentos
 */
function segmentosTeoricosContinuos(segmentos) {
  const seg = Array.isArray(segmentos) ? segmentos : [];
  if (seg.length <= 1) return true;
  const ordered = [...seg].sort((a, b) => {
    const ai = String(a?.ingreso_iso || a?.ingreso || "");
    const bi = String(b?.ingreso_iso || b?.ingreso || "");
    return ai.localeCompare(bi);
  });
  for (let i = 1; i < ordered.length; i++) {
    const prevEnd = new Date(ordered[i - 1].egreso_iso || ordered[i - 1].egreso).getTime();
    const curStart = new Date(ordered[i].ingreso_iso || ordered[i].ingreso).getTime();
    if (!Number.isFinite(prevEnd) || !Number.isFinite(curStart)) continue;
    if (curStart > prevEnd + 60000) return false;
  }
  return true;
}

/**
 * @param {object|null|undefined} cell — celda vis_* o capa mínima para UI
 * @param {boolean} [compact]
 * @returns {string}
 */
function horarioOperativoDesdeCeldaVis(cell, compact = false) {
  if (!cell || typeof cell !== "object") return "";
  const ingEnv = String(cell.rda_ingreso || cell.ingreso || "").trim();
  const egrEnv = String(cell.rda_egreso || cell.egreso || "").trim();
  const turnoId = String(cell.rda_turno_id || cell.turno_compuesto_id || "").trim();
  const segs = cell.segmentos || cell.rda_segmentos;
  const continuoPorSegs = Array.isArray(segs) && segs.length > 1
    ? segmentosTeoricosContinuos(segs)
    : null;
  const continuoPorTurno = esCompuestoContinuoEstandar(turnoId);
  if (ingEnv && egrEnv && (continuoPorSegs === true || (continuoPorSegs === null && continuoPorTurno))) {
    return compact ? rangoHhmmLabel(ingEnv, egrEnv) : `${ingEnv}–${egrEnv}`;
  }

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

module.exports = { ZONA_HORARIA_INSTITUCIONAL, isoToHhmmInstitucional, toHhmmInstitucionalDisplay, rangoHhmmLabel, resolverHorarioCelda, horarioDisplayDesdeSegmentos, horarioDisplayDesdeCapaTeorica, horarioOperativoDesdeCeldaVis };
