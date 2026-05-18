/**
 * @param {object | null | undefined} personaData
 * @param {{ tieneBolsas?: boolean }} [opts]
 */
export function detectHayCheckinPrevio(personaData, opts = {}) {
  if (personaData?.checkin_saldos_portal_en) return true;
  if (personaData?.checkin_lao_registrado_en) return true;
  if (opts.tieneBolsas === true) return true;
  return false;
}
