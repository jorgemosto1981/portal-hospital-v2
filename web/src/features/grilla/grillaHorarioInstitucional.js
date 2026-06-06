/**
 * Horarios institucionales (America/Argentina/Buenos_Aires) — alineado a vis_* y régimen.
 */

import {
  horarioOperativoDesdeCeldaVis,
  isoToHhmmInstitucional as horaDesdeIsoShared,
} from "../../../../shared/utils/horarioInstitucionalDisplay.js";

export {
  horarioDisplayDesdeCapaTeorica,
  horarioDisplayDesdeSegmentos,
  horarioOperativoDesdeCeldaVis,
} from "../../../../shared/utils/horarioInstitucionalDisplay.js";

/**
 * HH:mm desde ISO UTC del backend (ymdHoraToIso → toISOString).
 * @param {unknown} iso
 */
export function horaDesdeIso(iso) {
  return horaDesdeIsoShared(iso) || "";
}

/**
 * Horas efectivas de un tramo desde ISO materializado (prioridad sobre catálogo régimen).
 * Alineado a `computeResumenDesdeSegmentos` en capaTeoricaSegmentosCore.js.
 * @param {unknown} ingresoIso
 * @param {unknown} egresoIso
 */
export function horasDesdeIsoTramo(ingresoIso, egresoIso) {
  const t0 = new Date(String(ingresoIso || "")).getTime();
  const t1 = new Date(String(egresoIso || "")).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  return Math.round(((t1 - t0) / 3600000) * 100) / 100;
}

/**
 * @param {unknown} visDia
 * @param {{ capa_teorica?: { ingreso?: string; egreso?: string; horario_display?: string; segmentos?: unknown[]; tiene_huecos?: boolean } } | null | undefined} turnoVis
 */
export function horarioOperativoDesdeVis(visDia, turnoVis) {
  const cell =
    visDia && typeof visDia === "object"
      ? visDia
      : {
          rda_ingreso: turnoVis?.capa_teorica?.ingreso,
          rda_egreso: turnoVis?.capa_teorica?.egreso,
          rda_horario_display: turnoVis?.capa_teorica?.horario_display,
          rda_tiene_huecos: turnoVis?.capa_teorica?.tiene_huecos,
          segmentos: turnoVis?.capa_teorica?.segmentos,
          tiene_huecos: turnoVis?.capa_teorica?.tiene_huecos,
        };
  return horarioOperativoDesdeCeldaVis(cell, false);
}
