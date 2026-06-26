import { contarDiasCorridosInclusive } from "../../../../shared/utils/calendarInstitucionalCore.js";

const RX_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Días fijados por versión (p. ej. tope 1 día en 64-A) → fecha hasta automática.
 * @param {{ dias_solicitados?: number | null, requiere_opcion_consumo?: boolean } | null | undefined} articuloSel
 */
export function articuloRequiereOpcionConsumo(articuloSel) {
  return articuloSel?.requiere_opcion_consumo === true;
}

export function articuloTieneDiasPreestablecidos(articuloSel) {
  if (articuloRequiereOpcionConsumo(articuloSel)) return false;
  if (!articuloSel) return true;
  const d = Number(articuloSel.dias_solicitados);
  return !Number.isFinite(d) || d <= 1;
}

/**
 * @param {string} fechaDesde
 * @param {string} fechaHasta
 */
export function fechasSolicitudCompletas(fechaDesde, fechaHasta) {
  if (!RX_YMD.test(fechaDesde) || !RX_YMD.test(fechaHasta)) return false;
  return fechaHasta >= fechaDesde;
}

/**
 * @param {string} fechaDesde
 * @param {string} fechaHasta
 * @param {boolean} diasPreestablecidos
 * @param {number} diasDesdeArticulo
 */
export function resolverDiasSolicitadosPatronB(fechaDesde, fechaHasta, diasPreestablecidos, diasDesdeArticulo) {
  if (diasPreestablecidos) {
    const d = Number(diasDesdeArticulo);
    return Number.isFinite(d) && d > 0 ? Math.floor(d) : 1;
  }
  if (!fechasSolicitudCompletas(fechaDesde, fechaHasta)) return 1;
  return contarDiasCorridosInclusive(fechaDesde, fechaHasta);
}
