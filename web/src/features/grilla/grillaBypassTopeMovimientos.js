import {
  MENSAJE_BATCH_LIM_001,
  TOPE_MOVIMIENTOS_MAX,
} from "../../../../shared/utils/topeMovimientosConfig.js";

export { MENSAJE_BATCH_LIM_001, TOPE_MOVIMIENTOS_MAX };

export const COPY_BYPASS_TOPE_TITULO = "Excepción RRHH — tope de movimientos";

export const COPY_BYPASS_TOPE_AYUDA =
  `Supera el límite de ${TOPE_MOVIMIENTOS_MAX} movimientos por tramo y día. `
  + "Solo RRHH; el motivo queda auditado en el servidor.";

/**
 * @param {{ activo: boolean; motivo: string }} params
 * @returns {{ ok: boolean; error?: string; bypassTopeMovimientos?: boolean; motivoBypassTope?: string }}
 */
export function validarBypassTopeMovimientos({ activo, motivo }) {
  if (!activo) {
    return { ok: true, bypassTopeMovimientos: false };
  }
  const m = String(motivo || "").trim();
  if (m.length < 3) {
    return {
      ok: false,
      error: "Indicá el motivo de la excepción (mín. 3 caracteres).",
    };
  }
  return { ok: true, bypassTopeMovimientos: true, motivoBypassTope: m };
}

/**
 * @param {ReturnType<typeof validarBypassTopeMovimientos>} validacion
 * @returns {{ bypassTopeMovimientos?: boolean; motivoBypassTope?: string }}
 */
export function batchCtxDesdeBypass(validacion) {
  if (!validacion?.ok || !validacion.bypassTopeMovimientos) return {};
  return {
    bypassTopeMovimientos: true,
    motivoBypassTope: validacion.motivoBypassTope,
  };
}
