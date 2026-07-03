/** @param {string} ymd */
function formatYmdEs(ymd) {
  const s = String(ymd || "").slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * @param {{
 *   fecha_desde?: string | null;
 *   fecha_hasta?: string | null;
 *   dias_solicitados?: number | null;
 * }} resumen
 */
export function textoPeriodoResumenGrilla(resumen) {
  const desde = String(resumen?.fecha_desde || "").slice(0, 10);
  const hasta = String(resumen?.fecha_hasta || "").slice(0, 10);
  if (!desde) return "—";
  const rango =
    hasta && hasta !== desde ? `${formatYmdEs(desde)} → ${formatYmdEs(hasta)}` : formatYmdEs(desde);
  const dias = Number(resumen?.dias_solicitados);
  if (Number.isFinite(dias) && dias > 0) {
    return `${rango} · ${dias} día${dias === 1 ? "" : "s"}`;
  }
  return rango;
}

/**
 * @param {{
 *   fecha_desde_original?: string | null;
 *   fecha_hasta_original?: string | null;
 * }} resumen
 */
export function textoPeriodoOriginalAgenteResumenGrilla(resumen) {
  const desde = String(resumen?.fecha_desde_original || "").slice(0, 10);
  const hasta = String(resumen?.fecha_hasta_original || "").slice(0, 10);
  if (!desde) return "";
  if (hasta && hasta !== desde) {
    return `${formatYmdEs(desde)} → ${formatYmdEs(hasta)}`;
  }
  return formatYmdEs(desde);
}
