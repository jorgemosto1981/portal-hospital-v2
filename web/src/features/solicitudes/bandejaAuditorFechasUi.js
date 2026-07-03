import { contarDiasCorridosInclusive } from "../../../../shared/utils/calendarInstitucionalCore.js";
import { fechasSolicitudCompletas } from "./patronBFechasUi.js";

/**
 * Rango original del aviso (estimado agente) expuesto en listado bandeja.
 * @param {{ fecha_desde?: string, fecha_hasta?: string } | null | undefined} sel
 */
export function fechasOriginalesDesdeSel(sel) {
  const desde = String(sel?.fecha_desde || "").slice(0, 10);
  const hasta = String(sel?.fecha_hasta || "").slice(0, 10);
  return { desde, hasta };
}

/**
 * @param {string} origDesde
 * @param {string} origHasta
 * @param {string} editDesde
 * @param {string} editHasta
 */
export function fechasModificadasPorAuditor(origDesde, origHasta, editDesde, editHasta) {
  const oD = String(origDesde || "").slice(0, 10);
  const oH = String(origHasta || "").slice(0, 10);
  const eD = String(editDesde || "").slice(0, 10);
  const eH = String(editHasta || "").slice(0, 10);
  return eD !== oD || eH !== oH;
}

/**
 * @param {string} fechaDesde
 * @param {string} fechaHasta
 */
export function diasCorridosBandejaAuditor(fechaDesde, fechaHasta) {
  if (!fechasSolicitudCompletas(fechaDesde, fechaHasta)) return 0;
  return contarDiasCorridosInclusive(fechaDesde, fechaHasta);
}

export { fechasSolicitudCompletas };
