const TURNO_TOKEN_HINTS = [
  [/manana/i, "M"],
  [/tarde/i, "T"],
  [/noche/i, "N"],
];

/**
 * Abreviatura M/T/N desde id cfg_reg_turno_* o token corto.
 * @param {string} id
 */
export function labelTurnoToken(id) {
  const s = String(id || "").trim();
  if (!s) return "";
  if (/^[MTN]$/i.test(s)) return s.toUpperCase();
  for (const [re, lbl] of TURNO_TOKEN_HINTS) {
    if (re.test(s)) return lbl;
  }
  return "";
}

import { horaDesdeIso } from "./grillaHorarioInstitucional.js";

/**
 * Labels legibles para segmentos de capa_teorica (sin IDs técnicos en UI).
 * @param {Array<{ segmento_id: string; ingreso_iso?: string; egreso_iso?: string }>} segmentos
 * @param {Record<string, { etiqueta?: string; turno_id?: string }>} turnosPorId
 */
export function enrichCapaTeoricaLabels(segmentos, turnosPorId = {}) {
  return (segmentos || []).map((seg) => {
    const meta = turnosPorId[seg.segmento_id] || {};
    const ingreso = seg.ingreso_iso ? horaDesdeIso(seg.ingreso_iso) : "—";
    const egreso = seg.egreso_iso ? horaDesdeIso(seg.egreso_iso) : "—";
    let etiqueta = meta.codigo_interno || labelTurnoToken(seg.segmento_id) || meta.etiqueta || "";
    if (!etiqueta || /^__+horario__+$/i.test(etiqueta)) {
      etiqueta = ingreso !== "—" && egreso !== "—" ? `${ingreso}–${egreso}` : "Turno";
    }
    return {
      ...seg,
      segmento_label: etiqueta,
      horario_label: `${ingreso} – ${egreso}`,
      checkbox_label: `${etiqueta} (${ingreso}–${egreso})`,
    };
  });
}

/**
 * @param {object} regimenesIdx — map regimen_id → cfg_regimen_horario
 * @param {string} regimenId
 */
/**
 * Tramos que el titular aún ejecuta (cubribles); excluye tramos ya cedidos a otro ejecutante.
 * @param {Array<{ persona_titular_id?: string; persona_ejecutante_id?: string }>} segmentos
 * @param {string} personaTitularId
 */
export function filtrarSegmentosActivosTitular(segmentos, personaTitularId) {
  const pid = String(personaTitularId || "").trim();
  return (segmentos || []).filter(
    (s) => s.persona_titular_id === pid && s.persona_ejecutante_id === pid,
  );
}

export function turnosDisponiblesDesdeRegimen(regimenesIdx, regimenId) {
  const reg = regimenesIdx?.[regimenId];
  const out = {};
  for (const t of reg?.turnos_disponibles || []) {
    if (t.turno_id) out[t.turno_id] = t;
  }
  return out;
}
