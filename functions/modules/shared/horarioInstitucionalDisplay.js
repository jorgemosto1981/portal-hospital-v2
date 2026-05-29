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

module.exports = { ZONA_HORARIA_INSTITUCIONAL, isoToHhmmInstitucional, toHhmmInstitucionalDisplay, rangoHhmmLabel, resolverHorarioCelda };
