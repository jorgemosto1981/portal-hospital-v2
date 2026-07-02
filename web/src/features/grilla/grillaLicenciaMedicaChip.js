/** Alineado con MDC fan-out (`mdcFanOutVis.js`) y motor P4.4 (`S_MED_LARGA`). */
export const FASE_MOTOR_S_MED_LARGA = "S_MED_LARGA";

/** Color institucional Art. 16 — `ART16_19_P44_SPECS.json` / cfg versión. */
export const COLOR_CHIP_LM_LARGA = "#7C3AED";

const RX_CODIGO_LM = /^LM(-[A-Z0-9]+)?$/i;

/**
 * @param {Record<string, unknown> | null | undefined} evento
 */
export function eventoEsLicenciaMedicaLarga(evento) {
  return String(evento?.fase_motor || "").trim() === FASE_MOTOR_S_MED_LARGA;
}

/**
 * @param {Record<string, unknown> | null | undefined} evento
 */
function eventoPareceLicenciaMedica(evento) {
  const cod = String(evento?.codigo_grilla || "").trim();
  return RX_CODIGO_LM.test(cod);
}

/**
 * Config visual del chip en celda — solo metadatos `vis_*` (no lee `sol_`).
 *
 * @param {Record<string, unknown> | null | undefined} evento
 * @returns {{
 *   esLarga: boolean;
 *   label: string;
 *   tooltip: string;
 *   colorUi: string | null;
 * } | null}
 */
export function renderChipLicenciaMedica(evento) {
  if (!evento || typeof evento !== "object") return null;
  const codigoRaw = String(evento.codigo_grilla || "").trim();
  if (!eventoEsLicenciaMedicaLarga(evento) && !eventoPareceLicenciaMedica(evento)) {
    return null;
  }

  const esLarga = eventoEsLicenciaMedicaLarga(evento);
  const cie10 = String(evento.cie10_codigo || "").trim();

  if (esLarga) {
    const label = codigoRaw === "LM-L" ? "LM-L" : "LM-L";
    const tooltip = cie10
      ? `Licencia larga (Art. 16/19) · episodio continuo · CIE-10 ${cie10}`
      : "Licencia larga (Art. 16/19) · episodio continuo (S_MED_LARGA)";
    return {
      esLarga: true,
      label,
      tooltip,
      colorUi: COLOR_CHIP_LM_LARGA,
    };
  }

  const label = codigoRaw || "LM";
  let tooltip = "Licencia médica corta (Art. 14)";
  if (label === "LM-P") tooltip = "Aviso médico provisorio (pendiente certificado)";
  return {
    esLarga: false,
    label,
    tooltip,
    colorUi: null,
  };
}
