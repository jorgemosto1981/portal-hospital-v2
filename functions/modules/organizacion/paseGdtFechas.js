"use strict";

/**
 * Fechas de pase GDT — SPIKE_PASES_GDT_FASE2_V2.md §1
 * fecha_efectiva = último día en origen; destino inicia al día siguiente.
 */

const { sumarDiasCalendarioYmd } = require("../shared/licenciaMedicaParametrosCore");
const { normalizeYmd } = require("./obtenerPlantelPorGdtCore");

/**
 * @param {string} fechaEfectivaYmd
 * @returns {{ ok: true, fecha_efectiva: string, fecha_inicio_destino: string } | { ok: false, code: string, message: string }}
 */
function resolverFechasPaseGdt(fechaEfectivaYmd) {
  const fecha = normalizeYmd(fechaEfectivaYmd);
  if (!fecha) {
    return { ok: false, code: "invalid-argument", message: "fecha_efectiva inválida (YYYY-MM-DD)." };
  }
  try {
    const fechaInicioDestino = sumarDiasCalendarioYmd(fecha, 1);
    return { ok: true, fecha_efectiva: fecha, fecha_inicio_destino: fechaInicioDestino };
  } catch {
    return { ok: false, code: "invalid-argument", message: "No se pudo calcular fecha_inicio destino." };
  }
}

module.exports = { resolverFechasPaseGdt };
