"use strict";

const { FASE_MOTOR_S_MED_LARGA } = require("./licenciaMedicaEpisodioCore");
const { CFG_MLM_LARGA_EPISODIO } = require("./licenciaMedicaTramosCore");

/**
 * Metadatos de motor médico para payload MDC / fan-out vis (chip S_MED_LARGA).
 *
 * @param {Record<string, unknown>} sol
 * @returns {{ fase_motor: string, cie10_codigo?: string, causal_larga_duracion_id?: string } | null}
 */
function resolverMetadatosLicenciaMedicaParaMdc(sol) {
  const d = sol && typeof sol === "object" ? sol : {};
  const lm = d.licencia_medica && typeof d.licencia_medica === "object" ? d.licencia_medica : null;

  let fase_motor = lm ? String(lm.fase_motor || "").trim() : "";
  if (fase_motor === FASE_MOTOR_S_MED_LARGA) {
    // ok
  } else if (
    lm &&
    String(lm.modo_licencia_medica_id || "").trim() === CFG_MLM_LARGA_EPISODIO
  ) {
    fase_motor = FASE_MOTOR_S_MED_LARGA;
  } else {
    fase_motor = "";
  }

  const cie10 = d.cie10 && typeof d.cie10 === "object" ? d.cie10 : null;
  const cie10_codigo = String(cie10?.codigo || "").trim();
  const causal = String(
    d.causal_larga_duracion_id ||
      (lm && typeof lm.causal_larga_duracion_id === "string" ? lm.causal_larga_duracion_id : "") ||
      "",
  ).trim();

  if (!fase_motor && (cie10_codigo || /^cfg_cld_/i.test(causal))) {
    fase_motor = FASE_MOTOR_S_MED_LARGA;
  }

  if (fase_motor !== FASE_MOTOR_S_MED_LARGA) return null;

  return {
    fase_motor: FASE_MOTOR_S_MED_LARGA,
    ...(cie10_codigo ? { cie10_codigo } : {}),
    ...( /^cfg_cld_/i.test(causal) ? { causal_larga_duracion_id: causal } : {}),
  };
}

/**
 * @param {Record<string, unknown>} sol
 * @param {Record<string, unknown>} p payload MDC normalizado parcial
 */
function fusionarMetadatosLicenciaMedicaEnPayload(sol, p) {
  const meta = resolverMetadatosLicenciaMedicaParaMdc(sol);
  if (!meta) return p;
  return {
    ...p,
    fase_motor: meta.fase_motor,
    ...(meta.cie10_codigo ? { cie10_codigo: meta.cie10_codigo } : {}),
    ...(meta.causal_larga_duracion_id
      ? { causal_larga_duracion_id: meta.causal_larga_duracion_id }
      : {}),
  };
}

module.exports = {
  resolverMetadatosLicenciaMedicaParaMdc,
  fusionarMetadatosLicenciaMedicaEnPayload,
};
