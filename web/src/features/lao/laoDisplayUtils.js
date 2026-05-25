/**
 * Utilidades de presentación wizard LAO (sin lógica de negocio).
 */

/**
 * @param {object} b
 * @param {number} anioCalendarioCivil
 */
export function bolsaTieneSaldoPositivoVisible(b, anioCalendarioCivil) {
  const anio = Number(b?.anio_origen);
  if (Number.isInteger(anioCalendarioCivil) && anio === anioCalendarioCivil) {
    return true;
  }
  const disp = Number(b?.disponible);
  return Number.isFinite(disp) && disp > 0;
}

/**
 * Agrupa fines de semana; feriados/asuetos quedan detallados.
 * @param {Array<{ fecha: string, fecha_formateada: string, motivo: string }>} dias
 * @returns {Array<{ key: string, text: string }>}
 */
export function lineasDiasDescontadosDisplay(dias) {
  const list = Array.isArray(dias) ? dias : [];
  const finesSemana = list.filter((d) => String(d.motivo || "").trim() === "Fin de semana");
  const otros = list.filter((d) => String(d.motivo || "").trim() !== "Fin de semana");

  /** @type {Array<{ key: string, text: string }>} */
  const out = [];
  if (finesSemana.length > 0) {
    const n = finesSemana.length;
    out.push({
      key: "fin-de-semana",
      text: `${n} ${n === 1 ? "día" : "días"} por fin de semana`,
    });
  }
  for (const d of otros) {
    out.push({
      key: d.fecha,
      text: `${d.fecha_formateada} (${d.motivo})`,
    });
  }
  return out;
}
