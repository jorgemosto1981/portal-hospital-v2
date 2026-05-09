/**
 * Motor de plazos documentales — capa Licencias/Artículos.
 * Resta feriados institucionales sobre fechas laborables ya calculadas por Asistencia (RDA pura).
 *
 * @see docs/v2/MODULO_CONFIGURACION_ARTICULOS_V2.md
 */

/**
 * Determina si un registro de feriado institucional aplica al agente (OR multi-efector).
 * - `alcance_efector_id` ausente, null o string vacío → feriado global (aplica si el agente tiene al menos un efector).
 * - Si viene definido → aplica solo si ese efector está en la lista del agente.
 *
 * @param {{ fecha: string, alcance_efector_id?: string | null }} feriado
 * @param {string[]} efectoresAgente IDs de efectores con vínculo vigente del agente
 * @returns {boolean}
 */
export function feriadoAplicaAlAgente(feriado, efectoresAgente) {
  if (!feriado?.fecha) return false;
  const efectores = Array.isArray(efectoresAgente) ? efectoresAgente : [];
  const alcance = feriado.alcance_efector_id;
  const global =
    alcance === undefined ||
    alcance === null ||
    (typeof alcance === 'string' && alcance.trim() === '');
  if (global) return efectores.length > 0;
  return efectores.includes(alcance);
}

/**
 * Devuelve las fechas laborables que permanecen después de excluir días que son feriado
 * institucional aplicable al agente (lógica OR: basta que el feriado aplique por efector).
 *
 * @param {string[]} fechasLaborables ISO YYYY-MM-DD (p. ej. salida de getDiasLaborablesAgente)
 * @param {Array<{ fecha: string, alcance_efector_id?: string | null }>} feriadosInstitucionales Documentos cfg_cfi_* (simulados o Firestore)
 * @param {string[]} efectoresAgente IDs de efectores del agente en fecha de cálculo
 * @returns {string[]} Subconjunto de fechasLaborables sin los días feriado aplicables
 */
export function getVencimientoDocumental(
  fechasLaborables,
  feriadosInstitucionales,
  efectoresAgente,
) {
  const laborables = Array.isArray(fechasLaborables) ? fechasLaborables : [];
  const efectores = Array.isArray(efectoresAgente) ? efectoresAgente : [];
  const fechasQuitadas = new Set();

  for (const feriado of feriadosInstitucionales || []) {
    if (!feriadoAplicaAlAgente(feriado, efectores)) continue;
    fechasQuitadas.add(feriado.fecha);
  }

  return laborables.filter((dia) => !fechasQuitadas.has(dia));
}
