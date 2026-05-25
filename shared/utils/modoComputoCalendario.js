/**
 * Modo de cómputo de días derivado de `regla_computo_dias_id` (selector maestro del configurador).
 * @see docs/v2/MODULO_CALENDARIO_INSTITUCIONAL.md
 */

export const CFG_RCD_CORRIDOS = "cfg_rcd_corridos";
export const CFG_RCD_HABILES_SIMPLE = "cfg_rcd_habiles_simple";
export const CFG_RCD_HABILES_COMPUESTO = "cfg_rcd_habiles_compuesto";

export const MODO_COMPUTO_CORRIDOS = "CORRIDOS";
export const MODO_COMPUTO_HABILES = "HABILES";

/**
 * @param {Record<string, unknown> | null | undefined} versionData
 * @returns {{
 *   modo: string,
 *   usaCalendario: boolean,
 *   reglaId: string,
 *   incluyeFeriadosInstitucionales: boolean,
 * }}
 */
export function readModoCalculo(versionData) {
  const topes =
    versionData && typeof versionData === "object" ? versionData.bloque_topes_plazos_computo : null;
  const reglaId =
    topes && typeof topes === "object" ? String(topes.regla_computo_dias_id || "").trim() : "";

  if (reglaId === CFG_RCD_CORRIDOS) {
    return {
      modo: MODO_COMPUTO_CORRIDOS,
      usaCalendario: false,
      reglaId,
      incluyeFeriadosInstitucionales: false,
    };
  }
  if (reglaId === CFG_RCD_HABILES_SIMPLE) {
    return {
      modo: MODO_COMPUTO_HABILES,
      usaCalendario: true,
      reglaId,
      incluyeFeriadosInstitucionales: false,
    };
  }
  if (reglaId === CFG_RCD_HABILES_COMPUESTO) {
    return {
      modo: MODO_COMPUTO_HABILES,
      usaCalendario: true,
      reglaId,
      incluyeFeriadosInstitucionales: true,
    };
  }

  /** Compat: versiones con solo el flag legacy sin regla hábil explícita. */
  if (topes && typeof topes === "object" && topes.usa_calendario_institucional === true) {
    return {
      modo: MODO_COMPUTO_HABILES,
      usaCalendario: true,
      reglaId,
      incluyeFeriadosInstitucionales: true,
    };
  }

  return {
    modo: MODO_COMPUTO_CORRIDOS,
    usaCalendario: false,
    reglaId,
    incluyeFeriadosInstitucionales: false,
  };
}

/**
 * Valor persistido en Firestore (espejo del modo; la SSoT de ejecución es `regla_computo_dias_id`).
 * @param {Record<string, unknown>} topes
 */
export function syncUsaCalendarioInstitucionalEnTopes(topes) {
  if (!topes || typeof topes !== "object") return topes;
  const { usaCalendario } = readModoCalculo({ bloque_topes_plazos_computo: topes });
  return { ...topes, usa_calendario_institucional: usaCalendario };
}
