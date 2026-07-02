/** @see docs/v2/SEED_CATALOGOS_ARTICULOS_V2.json cfg_modo_licencia_medica */
export const CFG_MLM_LARGA_EPISODIO = "cfg_mlm_larga_episodio";

export { TOPE_DIAS_LICENCIA_MEDICA_LARGA } from "../../schemas/solicitudMedLargaCie10.schema.js";

/**
 * @param {{ modo_licencia_medica_id?: string, requiere_causal_larga?: boolean } | null | undefined} articuloSel
 */
export function articuloEsLicenciaMedicaLarga(articuloSel) {
  if (!articuloSel) return false;
  if (articuloSel.requiere_causal_larga === true) return true;
  return String(articuloSel.modo_licencia_medica_id || "").trim() === CFG_MLM_LARGA_EPISODIO;
}
