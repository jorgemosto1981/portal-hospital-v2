import { celdaVisIndicaFrancoOperativo } from "../../../../shared/utils/visCeldaFusionLectura.js";

/**
 * Sufijo del título del modal día (evita "— licencias" en franco o jornada sin solicitudes).
 *
 * @param {{
 *   incompletoPlan?: boolean;
 *   cantidadEventosLicencia?: number;
 *   celdaVis?: Record<string, unknown> | null;
 *   turnoTeoricoEfectivo?: { es_franco?: boolean } | null;
 *   tieneHistorialGestionTurno?: boolean;
 * }} ctx
 * @returns {string}
 */
export function sufijoTituloDiaGrillaDetalleModal(ctx) {
  const n = Number(ctx?.cantidadEventosLicencia) || 0;
  if (n > 0) return " — licencias";

  if (ctx?.incompletoPlan) return " — sin turno en plan";

  const celda = ctx?.celdaVis;
  if (
    celdaVisIndicaFrancoOperativo(celda)
    || ctx?.turnoTeoricoEfectivo?.es_franco === true
  ) {
    return " — franco";
  }

  if (ctx?.tieneHistorialGestionTurno) return " — gestión de turno";

  const tid = String(celda?.rda_turno_id || ctx?.turnoTeoricoEfectivo?.rda_turno_id || "").trim();
  if (tid && tid !== "F" && tid !== "NL") return " — jornada";

  return "";
}
