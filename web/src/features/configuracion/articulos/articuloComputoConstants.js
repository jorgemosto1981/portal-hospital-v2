/** Ids de catálogo — unidad de medida del saldo (jornadas ocultas en UI hasta tener norma). */
export const CFG_UMA_DIAS = "cfg_uma_dias";
export const CFG_UMA_HORAS = "cfg_uma_horas";
export const CFG_UMA_JORNADAS = "cfg_uma_jornadas";

export const UMC_IDS_DIAS = Object.freeze(["cfg_umc_dia_completo", "cfg_umc_medio_dia"]);
export const UMC_IDS_HORAS = Object.freeze(["cfg_umc_horas", "cfg_umc_minutos"]);

/** @param {{ value: string, label: string }[]} options */
export function filterUnidadMedidaOptions(options) {
  return options.filter((o) => o.value !== CFG_UMA_JORNADAS);
}

/** @param {{ value: string, label: string }[]} options */
export function filterUnidadMinimaPorMedida(unidadMedidaId, options) {
  if (unidadMedidaId === CFG_UMA_DIAS) {
    return options.filter((o) => UMC_IDS_DIAS.includes(o.value));
  }
  if (unidadMedidaId === CFG_UMA_HORAS) {
    return options.filter((o) => UMC_IDS_HORAS.includes(o.value));
  }
  return options;
}
